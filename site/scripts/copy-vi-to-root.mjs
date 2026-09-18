#!/usr/bin/env node
/**
 * copy-vi-to-root.mjs — sinh BẢN SAO CẤP GỐC (không tiền tố ngôn ngữ) của mọi
 * trang tiếng Việt, chạy SAU `astro build`.
 *
 * Vì sao cần: GitHub Pages không có redirect server-side, nên các URL cũ của site
 * dạng 'todaytourist.com/tim-tour/' (không có '/vi/') phải tồn tại thật. Sau khi
 * Astro build xong, script copy `.astro-dist/vi/**` lên thẳng `.astro-dist/**`:
 *
 *   .astro-dist/vi/tim-tour/index.html          -> .astro-dist/tim-tour/index.html
 *   .astro-dist/vi/tours/index.html             -> .astro-dist/tours/index.html
 *   .astro-dist/vi/tours/<slug>/index.html      -> .astro-dist/tours/<slug>/index.html
 *   .astro-dist/vi/tours/khu-vuc/<region>/...   -> .astro-dist/tours/khu-vuc/<region>/...
 *   .astro-dist/vi/tin-tuc/<slug>/index.html    -> .astro-dist/tin-tuc/<slug>/index.html
 *
 * Bản copy là BẢN SAO Y NGUYÊN của trang '/vi/…' tương ứng, và vì canonical,
 * hreflang, breadcrumb, og:url của trang '/vi/…' đều trỏ về chính nó (xem
 * `canonicalPath` trong src/lib/seo.js) nên bản ở root tự động trỏ canonical về
 * '/vi/…' → Google chỉ index 1 URL duy nhất, không sinh duplicate content.
 *
 * KHÔNG copy (xem SKIP):
 *   - 'index.html' cấp gốc của /vi/: trang chủ đã có riêng ở src/pages/index.astro
 *     (cũng canonical về '/vi/').
 *   - 'home/': trang công cụ nội bộ /vi/home/generated/ (noindex) — không được lộ
 *     ra '/home/generated/'.
 *
 * Được gọi tự động bởi `npm run build` (site/package.json) và bởi CI
 * (.github/workflows/build.yml) sau bước "Build Astro".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, '.astro-dist');
const SRC = path.join(DIST, 'vi');

/** Mục ở cấp gốc của /vi/ KHÔNG được copy lên root. */
const SKIP = new Set(['index.html', 'home']);

if (!fs.existsSync(DIST)) {
  console.error('[vi-root] Không thấy .astro-dist — chạy `astro build` trước.');
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error('[vi-root] Không thấy .astro-dist/vi — bỏ qua.');
  process.exit(1);
}

let copiedDirs = 0;
let copiedFiles = 0;

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copiedDirs += 1;
      copyTree(src, dst);
    } else {
      fs.copyFileSync(src, dst);
      copiedFiles += 1;
    }
  }
}

for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
  if (SKIP.has(entry.name)) continue;
  const src = path.join(SRC, entry.name);
  const dst = path.join(DIST, entry.name);
  if (entry.isDirectory()) {
    copiedDirs += 1;
    copyTree(src, dst);
    console.log(`[vi-root] /vi/${entry.name}/ -> /${entry.name}/`);
  } else {
    fs.copyFileSync(src, dst);
    copiedFiles += 1;
    console.log(`[vi-root] /vi/${entry.name} -> /${entry.name}`);
  }
}

console.log(`[vi-root] đã copy ${copiedDirs} thư mục, ${copiedFiles} file lên root.`);
