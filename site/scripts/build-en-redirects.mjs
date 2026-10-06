#!/usr/bin/env node
/**
 * build-en-redirects.mjs — gộp các URL tiếng Anh cũ (/en/…) về bản tiếng Việt.
 *
 * BỐI CẢNH
 * Website đã BỎ bản tiếng Anh (2026-10): `LANGS` chỉ còn 'vi' nên router không
 * build `/en/…` nữa. Nhưng các URL đó đã được Google index, GitHub Pages lại
 * không có 301 server-side và trả 404 cho path không có file → mất tín hiệu SEO.
 *
 * CÁCH LÀM
 * Soi cây output `/vi/**` vừa build (mọi thư mục có `index.html`) rồi sinh
 * `.astro-dist/en/<đường-dẫn-tương-ứng>/index.html`:
 *   - HTTP 200 (không còn 404),
 *   - `<link rel="canonical" href="/vi/…">` → Google gộp tín hiệu về bản tiếng Việt,
 *   - `<meta http-equiv="refresh" content="0; url=…">` + `location.replace()` —
 *     chuyển ngay lập tức (khác trang URL cũ đổi tên: ở đây không cần đếm giờ),
 *   - CỐ Ý KHÔNG đặt `noindex`: có `noindex` thì Google bỏ qua `canonical` và
 *     tín hiệu KHÔNG được gộp (xem chú thích trong build-legacy-redirects.mjs).
 *
 * Không ghi đè: `/en/<path>/` nào đã có trang thật trong output thì bỏ qua, nên
 * nếu sau này bật lại tiếng Anh thì trang thật tự "thắng" bản chuyển hướng.
 *
 * Được gọi bởi `npm run build` (site/package.json) và CI (.github/workflows/build.yml).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const DIST = path.join(ROOT, '.astro-dist');
const VI_DIR = path.join(DIST, 'vi');
const EN_DIR = path.join(DIST, 'en');

/** Domain chính — phải khớp `site` trong astro.config.mjs + file CNAME + lib/seo.js. */
const SITE_URL = 'https://todaytourist.com';

if (!fs.existsSync(VI_DIR)) {
  console.error('[en-redirect] Không thấy .astro-dist/vi — chạy `astro build` trước.');
  process.exit(1);
}

const c = JSON.parse(fs.readFileSync(path.join(REPO, 'content', 'vi', 'common.json'), 'utf8'));
const brand = c.brand_name || 'TODAYTOURIST';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function html(target) {
  const abs = SITE_URL + target;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Đã gộp về bản tiếng Việt · ${esc(brand)}</title>
<link rel="canonical" href="${esc(abs)}">
<meta http-equiv="refresh" content="0; url=${esc(abs)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<p>Bản tiếng Anh đã được gộp về bản tiếng Việt: <a href="${esc(target)}">${esc(abs)}</a></p>
</body>
</html>
`;
}

let created = 0;
let skipped = 0;

/** `rel` = đường dẫn tương đối trong /vi/ (rỗng = trang chủ). */
function writeRedirect(rel) {
  const target = rel ? `/vi/${rel}/` : '/vi/';
  const dir = rel ? path.join(EN_DIR, ...rel.split('/')) : EN_DIR;
  const file = path.join(dir, 'index.html');
  if (fs.existsSync(file)) {
    skipped += 1;
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, html(target), 'utf8');
  created += 1;
}

function walk(dir, rel) {
  if (fs.existsSync(path.join(dir, 'index.html'))) writeRedirect(rel);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    walk(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
  }
}

walk(VI_DIR, '');

console.log(`[en-redirect] tạo ${created} trang /en/… → /vi/… (bỏ qua ${skipped} đã có).`);
