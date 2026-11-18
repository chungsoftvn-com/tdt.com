#!/usr/bin/env node
/**
 * build-legacy-redirects.mjs — sinh "trang chuyển hướng" cho các URL CŨ.
 *
 * BỐI CẢNH
 * GitHub Pages không có 301 server-side và trả 404 cho mọi path không có file.
 * Các URL cũ của todaytourist.com (site ASP.NET/CMS trước, xem
 * `legacy-redirects.json`) đang được Google index và trả 404 → mất traffic.
 *
 * CÁCH LÀM
 * Với mỗi cặp `"/duong-dan-cu": "/duong-dan-moi/"` trong `site/legacy-redirects.json`,
 * script ghi `.astro-dist/<duong-dan-cu>/index.html`:
 *   - HTTP 200 (không còn 404),
 *   - `<link rel="canonical" href="<đích>">` → Google gộp tín hiệu về URL mới,
 *   - `<meta http-equiv="refresh" content="8; url=<đích>">` (fallback khi tắt JS),
 *   - đếm giờ bằng JS rồi `location.replace(<đích>)` — chuyển hướng thật,
 *   - giao diện đề xuất: nút "Đi tới trang mới ngay" + link nhanh tới các mục chính.
 *
 * LƯU Ý SEO
 * Trang này CỐ Ý KHÔNG đặt `noindex`: Google bỏ qua `canonical` khi có `noindex`,
 * nên nếu noindex thì tín hiệu sẽ KHÔNG được gộp về URL mới. Chỉ dùng canonical
 * (+ meta refresh + JS) là cách gộp tín hiệu đúng chuẩn.
 *
 * Không ghi đè: path nào đã có thư mục trong output (trang thật) thì bỏ qua, nên
 * thêm URL mới vào site sau này sẽ tự "thắng" bản chuyển hướng.
 *
 * Được gọi bởi `npm run build` (site/package.json) và CI (.github/workflows/build.yml).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const DIST = path.join(ROOT, '.astro-dist');
const MAP_FILE = path.join(ROOT, 'legacy-redirects.json');

/** Domain chính — phải khớp `site` trong astro.config.mjs + file CNAME + lib/seo.js. */
const SITE_URL = 'https://todaytourist.com';
/** Chuyển hướng tức thì (meta refresh 0 + location.replace) — Google coi như chuyển hướng vĩnh viễn; không còn trang đếm ngược 8 giây (khách thoát, Google báo soft 404). */
const DELAY = 0;

if (!fs.existsSync(DIST)) {
  console.error('[legacy] Không thấy .astro-dist — chạy `astro build` trước.');
  process.exit(1);
}
if (!fs.existsSync(MAP_FILE)) {
  console.error(`[legacy] Không thấy ${path.relative(REPO, MAP_FILE)}.`);
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const c = JSON.parse(fs.readFileSync(path.join(REPO, 'content', 'vi', 'common.json'), 'utf8'));

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Link nhanh (nhãn lấy từ content/vi/common.json — không hard-code chữ trong script). */
const QUICK = [
  { href: '/vi/tours/', label: c.nav_tours },
  { href: '/vi/tim-tour/', label: c.nav_find_tour },
  { href: '/vi/tin-tuc/', label: c.nav_news },
  { href: '/vi/y-kien-khach-hang/', label: c.nav_testimonials },
  { href: '/vi/ve-may-bay/', label: c.nav_tickets },
  { href: '/vi/cho-thue-xe/', label: c.nav_car },
  { href: '/vi/contact/', label: c.nav_contact },
].filter((x) => x.label);

function html(from, to) {
  const abs = SITE_URL + to;
  const brand = c.brand_name || 'TODAYTOURIST';
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand)}</title>
<link rel="canonical" href="${esc(abs)}">
<meta http-equiv="refresh" content="0; url=${esc(abs)}">
<script>location.replace(${JSON.stringify(to)});</script>
</head>
<body>
<p><a href="${esc(to)}">${esc(brand)} – mở trang</a></p>
</body>
</html>
`;
}

let created = 0;
let skipped = 0;
let failed = 0;

for (const [rawFrom, to] of Object.entries(map)) {
  if (rawFrom.startsWith('_')) continue;
  if (typeof to !== 'string' || !to.startsWith('/')) {
    console.error(`[legacy] Bỏ qua "${rawFrom}" — đích không hợp lệ: ${to}`);
    failed += 1;
    continue;
  }
  let from;
  try {
    from = decodeURIComponent(rawFrom);
  } catch {
    from = rawFrom;
  }
  const seg = from.split('/').filter(Boolean);
  if (!seg.length) continue;

  const dir = path.join(DIST, ...seg);
  // Path đã là trang thật trong site mới → không ghi đè.
  if (fs.existsSync(dir)) {
    console.log(`[legacy] bỏ qua (đã có trang thật): ${from}`);
    skipped += 1;
    continue;
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html(from, to), 'utf8');
    created += 1;
  } catch (err) {
    console.error(`[legacy] LỖI khi tạo "${from}": ${err.message}`);
    failed += 1;
  }
}

console.log(
  `[legacy] đã tạo ${created} trang chuyển hướng (bỏ qua ${skipped} path đã có trang thật` +
    (failed ? `, ${failed} lỗi` : '') +
    ').',
);
