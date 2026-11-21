// Update the gallery after a verified Page webhook; never log access tokens.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { FB_PAGE_ID, FB_PAGE_TOKEN } = process.env;
if (!/^\d+$/.test(FB_PAGE_ID || '') || !FB_PAGE_TOKEN) throw new Error('Missing Facebook Page credentials');
const maxSize = 10 * 1024 * 1024;
function safeImage(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') ||
      !['fbcdn.net', 'fbsbx.com'].some(host => u.hostname === host || u.hostname.endsWith('.' + host))) {
    throw new Error('Untrusted Facebook image host');
  }
  return u;
}
async function download(value, hops = 0) {
  const res = await fetch(safeImage(value), { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    if (hops >= 3) throw new Error('Too many image redirects');
    await res.body?.cancel();
    return download(new URL(res.headers.get('location'), value).href, hops + 1);
  }
  if (!res.ok || Number(res.headers.get('content-length') || 0) > maxSize) throw new Error('Image download failed');
  const chunks = []; let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length; if (size > maxSize) throw new Error('Image too large'); chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const ext = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'jpg' :
    bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' :
    bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'webp' : null;
  if (!ext) throw new Error('Unsupported image format');
  return { bytes, ext };
}
const url = new URL(`https://graph.facebook.com/v21.0/${FB_PAGE_ID}/posts`);
url.searchParams.set('fields', 'id,full_picture,permalink_url,message,created_time'); url.searchParams.set('limit', '25');
// Rebuild each request on the trusted Graph origin; never follow a paging URL
// containing credentials or forward the Page token to another host.
const posts = []; const seenIds = new Set(); const seenCursors = new Set();
for (let page = 0; page < 100; page++) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${FB_PAGE_TOKEN}` },
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Facebook API returned ${res.status}; check Page permissions/token`);
  const payload = await res.json();
  if (payload.error || !Array.isArray(payload.data)) throw new Error('Invalid Facebook API response; gallery preserved');
  for (const post of payload.data) {
    if (post?.full_picture && post.permalink_url && !seenIds.has(post.id)) {
      posts.push(post); seenIds.add(post.id);
      if (posts.length === 5) break;
    }
  }
  if (posts.length === 5 || !payload.paging?.next) break;
  const after = payload.paging?.cursors?.after;
  if (typeof after !== 'string' || !after || seenCursors.has(after)) throw new Error('Invalid Facebook pagination; gallery preserved');
  if (page === 99) throw new Error('Facebook pagination limit reached; gallery preserved');
  seenCursors.add(after); url.searchParams.set('after', after);
}
if (!posts.length) throw new Error('No image posts returned; existing gallery preserved');
const jsonPath = join(root, 'content/vi/facebook.json');
const old = JSON.parse(await readFile(jsonPath, 'utf8'));
const downloads = await Promise.all(posts.map(async post => {
  const link = new URL(post.permalink_url);
  if (link.protocol !== 'https:' || !['facebook.com','www.facebook.com','m.facebook.com'].includes(link.hostname)) throw new Error('Invalid post URL');
  const id = String(post.id || ''); if (!/^[\d_]+$/.test(id)) throw new Error('Invalid post ID');
  const { bytes, ext } = await download(post.full_picture);
  return { bytes, photo: { image: `facebook/post-${id}.${ext}`, alt: (post.message || '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Hoạt động mới của TodayTourist trên Facebook', url: link.href } };
}));
const imgDir = join(root, 'content/vi/images/facebook'); await mkdir(imgDir, { recursive: true });
// All downloads validated before replacing any gallery entry.
let changed = JSON.stringify(old.photos) !== JSON.stringify(downloads.map(d => d.photo));
for (const { bytes, photo } of downloads) {
  const path = join(root, 'content/vi/images', photo.image);
  const existing = await readFile(path).catch(() => null);
  if (!existing?.equals(bytes)) { await writeFile(path + '.tmp', bytes); await rename(path + '.tmp', path); changed = true; }
}
if (changed) {
  old.photos = downloads.map(d => d.photo); old.synced_at = new Date().toISOString();
  await writeFile(jsonPath + '.tmp', JSON.stringify(old, null, 2) + '\n'); await rename(jsonPath + '.tmp', jsonPath);
}
console.log(changed ? `Updated ${downloads.length} Facebook photos` : 'Gallery unchanged');
