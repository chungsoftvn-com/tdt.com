#!/usr/bin/env node
/** Derive responsive WebP assets during the build; never modify original media. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// Reuse Astro's declared Sharp image dependency, including nested npm layouts.
const require = createRequire(import.meta.resolve('astro/package.json'));
const sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, '.astro-dist');
const output = path.join(dist, '_responsive');
const cache = path.join(root, '.image-cache');
const candidates = new Map();
const readAttr = (tag, name) => tag.match(new RegExp('(?:^|\\s)' + name + '=["\']([^"\']*)["\']', 'i'))?.[1];
const escape = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'admin' || entry.name === '_astro' || entry.name === '_responsive') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(p); else if (entry.name.endsWith('.html')) files.push(p);
  }
}
const tags = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<img\b[^>]*>/gi;
function localSource(src) {
  if (!src || !src.startsWith('/content/vi/images/') || /(?:^|[/_-])logo(?:[._/-]|$)/i.test(src)) return null;
  try {
    const decoded = decodeURIComponent(src.split(/[?#]/)[0].replace(/&amp;/g, '&'));
    const file = path.resolve(dist, '.' + decoded);
    return file.startsWith(path.join(dist, 'content/vi/images') + path.sep) && /\.(?:jpe?g|png|webp)$/i.test(file) ? file : null;
  } catch { return null; }
}
await walk(dist);
for (const file of files) {
  const html = await fs.readFile(file, 'utf8');
  for (const match of html.matchAll(tags)) {
    if (!/^<img\b/i.test(match[0])) continue;
    for (const name of ['src', 'data-src']) {
      const src = readAttr(match[0], name), source = localSource(src);
      if (source && !candidates.has(src)) candidates.set(src, { source });
    }
  }
}
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true }); await fs.mkdir(cache, { recursive: true });
let originalBytes = 0, mobileBytes = 0, generated = 0;
const queue = [...candidates.entries()];
const assetTasks = new Map();
async function worker() {
  while (queue.length) {
    const [src, item] = queue.shift();
    const bytes = await fs.readFile(item.source);
    if (bytes.length < 60000) continue;
    let meta;
    try { meta = await sharp(bytes).metadata(); } catch { console.warn('[images] Invalid image retained:', src); continue; }
    if (!meta.width || meta.width < 480 || (meta.pages || 1) > 1) continue;
    const digest = crypto.createHash('sha256').update(bytes).update('webp-v1-q80').digest('hex').slice(0, 20);
    const widths = [...new Set([480, Math.min(768, meta.width)].filter(w => w <= meta.width))].sort((a,b) => a-b);
    let task = assetTasks.get(digest);
    if (!task) {
      task = (async () => {
        const variants = [];
        for (const width of widths) {
          const name = `${digest}-${width}.webp`, cached = path.join(cache, name);
          try { await fs.access(cached); } catch {
            await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(cached);
          }
          await fs.copyFile(cached, path.join(output, name));
          variants.push({ width, url: '/_responsive/' + name }); generated++;
        }
        return variants;
      })();
      assetTasks.set(digest, task);
    }
    item.variants = await task;
    item.width = meta.width;
    originalBytes += bytes.length;
    mobileBytes += (await fs.stat(path.join(output, `${digest}-${widths[0]}.webp`))).size;
  }
}
await Promise.all([worker(), worker(), worker()]);
let rewritten = 0;
for (const file of files) {
  const html = await fs.readFile(file, 'utf8');
  const next = html.replace(tags, tag => {
    if (!/^<img\b/i.test(tag)) return tag;
    const src = readAttr(tag, 'src'), deferred = readAttr(tag, 'data-src');
    const entry = candidates.get(src), lazy = candidates.get(deferred);
    let out = tag;
    if (entry?.variants && !readAttr(tag, 'srcset')) {
      const choices = [...entry.variants];
      if (entry.width > choices.at(-1).width) choices.push({url: new URL(src, 'https://todaytourist.com').pathname, width: entry.width});
      const srcset = choices.map(v => `${v.url} ${v.width}w`).join(', ');
      const sizes = readAttr(tag, 'sizes') ? '' : ' sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 100vw, 768px"';
      out = out.replace(/\s*\/?\s*>$/, ` srcset="${escape(srcset)}"${sizes}>`);
    }
    if (lazy?.variants) {
      const v = lazy.variants.find(v => v.width >= 768) || lazy.variants.at(-1);
      out = out.replace(/\sdata-src=["'][^"']*["']/i, ` data-src="${v.url}"`);
    }
    return out;
  });
  if (next !== html) { await fs.writeFile(file, next); rewritten++; }
}
const report = { pages: rewritten, sources: [...candidates.values()].filter(v=>v.variants).length, variants: generated, originalBytes, mobileBytes };
await fs.writeFile(path.join(dist, 'responsive-image-report.json'), JSON.stringify(report));
console.log('[responsive images]', JSON.stringify(report));
