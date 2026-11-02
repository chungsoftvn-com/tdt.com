// Đồng bộ "Hình ảnh mới nhất từ Facebook" trên trang chủ.
// Lấy 5 bài mới nhất có ảnh từ Fanpage, tải ảnh về content/vi/images/facebook/
// và cập nhật content/vi/facebook.json. Cần biến môi trường FB_PAGE_ID, FB_PAGE_TOKEN.
// Thiếu token thì thoát êm (không làm hỏng build).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const jsonPath = join(root, 'content', 'vi', 'facebook.json');
const imgDir = join(root, 'content', 'vi', 'images', 'facebook');
const { FB_PAGE_ID, FB_PAGE_TOKEN } = process.env;
const API = process.env.FB_API_BASE || 'https://graph.facebook.com/v21.0';
const WANT = 5;

if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
  console.log('Thiếu FB_PAGE_ID/FB_PAGE_TOKEN; bỏ qua đồng bộ Facebook.');
  process.exit(0);
}

const url = `${API}/${FB_PAGE_ID}/posts?fields=full_picture,permalink_url,message,created_time&limit=25&access_token=${encodeURIComponent(FB_PAGE_TOKEN)}`;
const res = await fetch(url);
if (!res.ok) {
  console.error('Facebook API lỗi', res.status, (await res.text()).slice(0, 200));
  process.exit(1);
}
const posts = ((await res.json()).data || []).filter((p) => p.full_picture && p.permalink_url).slice(0, WANT);
if (posts.length < WANT) {
  console.log(`Chỉ có ${posts.length} bài có ảnh (<${WANT}); giữ nguyên dữ liệu cũ.`);
  process.exit(0);
}

const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
mkdirSync(imgDir, { recursive: true });
const photos = [];
for (let i = 0; i < posts.length; i++) {
  const p = posts[i];
  const name = `fb-${String(i + 2).padStart(2, '0')}.jpg`;
  const img = await fetch(p.full_picture);
  if (!img.ok) { console.error('Không tải được ảnh', i); process.exit(1); }
  writeFileSync(join(imgDir, name), Buffer.from(await img.arrayBuffer()));
  const alt = (p.message || '').replace(/\s+/g, ' ').trim().slice(0, 110) || 'Hình ảnh mới từ Facebook TodayTourist';
  photos.push({ image: `facebook/${name}`, alt, url: p.permalink_url });
}
data.photos = photos;
data.synced_at = new Date().toISOString().slice(0, 10);
writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
console.log('Đã đồng bộ', photos.length, 'ảnh từ Facebook.');
