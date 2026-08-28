#!/usr/bin/env node
/**
 * Khôi phục nội dung trang web CŨ vào hệ thống content mới.
 *
 * Nguồn : downloads/old/todaytourist.com/tours/*.html  (trang ASP.NET cũ)
 * Đích  : content/vi/tours/<slug>.json  (thêm `content` blocks + `itinerary`)
 * Ảnh   : copy từ thư mục cũ -> public/content/vi/images/ (không đè ảnh có sẵn)
 *
 * Cách chạy:
 *   node scripts/restore-old-content.mjs
 *   npm run build        # dịch vi->en + build (cần sau khi thêm content mới)
 *
 * Chỉ thêm/điền các trường còn thiếu; giữ nguyên dữ liệu đã chỉnh tay hiện có.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = path.join(ROOT, 'downloads', 'old', 'todaytourist.com');
const TOURS_DIR = path.join(OLD, 'tours');
const CONTENT_T = path.join(ROOT, 'content', 'vi', 'tours');
const INDEX_PATH = path.join(ROOT, 'content', 'vi', 'tours.json');
const IMG_DIR = path.join(ROOT, 'public', 'content', 'vi', 'images');

/** Các file là trang danh mục / phụ trợ — không phải tour. */
const SKIP = new Set([
  'dat-tour',
  'tim-tour',
  'khu-vuc',
  'tour-trong-nuoc',
  'tour-nuoc-ngoai',
]);

// ---------- Tiện ích HTML ----------
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bỏ tag HTML, giữ <br> thành xuống dòng. */
function toText(html) {
  return decodeEntities(
    html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function imgsOf(html) {
  const out = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src = (tag.match(/src\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    const alt = (tag.match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    if (src) out.push({ src: decodeEntities(src), alt: decodeEntities(alt) });
  }
  return out;
}

/** Token hoá h1/h2/h3/p/img theo thứ tự xuất hiện trong đoạn html. */
function tokenize(html) {
  const tokens = [];
  const re = /<(h1|h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === 'i') {
      const tag = m[0];
      const src = (tag.match(/src\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
      const alt = (tag.match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
      tokens.push({ kind: 'img', src: decodeEntities(src), alt: decodeEntities(alt) });
    } else {
      tokens.push({ kind: m[1], text: toText(m[2]), imgs: imgsOf(m[2]) });
    }
  }
  return tokens;
}

const stripEmoji = (s) => s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

// ---------- Ảnh ----------
function resolveImage(src) {
  const clean = decodeURIComponent(src)
    .replace(/^\.\.\//, '')
    .replace(/^\/+/, '')
    .split('?')[0];
  if (!clean) return null;
  const abs = path.join(OLD, clean);
  return fs.existsSync(abs) ? abs : null;
}

function copyImage(src) {
  const abs = resolveImage(src);
  if (!abs) return null;
  const name = path.basename(abs);
  const dest = path.join(IMG_DIR, name);
  if (!fs.existsSync(dest)) {
    try {
      fs.copyFileSync(abs, dest);
    } catch {
      return null;
    }
  }
  return name;
}

// ---------- Biên dịch 1 file cũ -> { name, desc, content, itinerary } ----------
function parseOldTour(file) {
  const html = fs.readFileSync(file, 'utf-8');
  const title = (html.match(/<title>\s*([\s\S]*?)\s*<\/title>/i) || [])[1] || '';
  const titleText = stripEmoji(toText(title));

  // 2 tab chính: "Chương trình Tour" (RadPageView1) + "Giá chi tiết" (RadPageView2)
  const i1 = html.indexOf('RadPageView1');
  const i2 = html.indexOf('RadPageView2', i1);
  const i3 = html.indexOf('RadPageView3', i2);
  const r1 = html.slice(i1, i2 > -1 ? i2 : undefined);
  const r2 = html.slice(i2, i3 > -1 ? i3 : undefined);

  const tok1 = tokenize(r1);
  const tok2 = tokenize(r2);

  let name = titleText;
  let desc = '';
  const content = [];
  const itinerary = [];
  let itDay = 0;
  let curIt = null;
  let imgCount = 0;

  for (const t of tok1) {
    if (t.kind === 'h1') {
      const line = stripEmoji(t.text).split('\n')[0];
      if (line && line.length > 4) name = line;
      continue;
    }
    if (t.kind === 'img') {
      const n = copyImage(t.src);
      if (n) content.push({ type: 'img', src: `/content/vi/images/${n}`, alt: t.alt || '' });
      imgCount += 1;
      continue;
    }
    if (t.kind === 'h2') {
      content.push({ type: 'h2', text: t.text });
      continue;
    }
    if (t.kind === 'h3') {
      // Mục lịch trình theo ngày (NGÀY / ĐÊM / BUỔI ...)
      itDay += 1;
      curIt = { day: itDay, title: t.text, body: '' };
      itinerary.push(curIt);
      content.push({ type: 'h3', text: t.text });
      continue;
    }
    // p
    const text = t.text;
    if (!desc && text.length > 40 && !/^(đưa rước|tour ghép|liên hệ|📞)/i.test(text)) {
      desc = text.split('\n')[0];
    }
    if (text) {
      content.push({ type: 'p', text });
      if (curIt) curIt.body += (curIt.body ? '\n' : '') + text;
    }
    for (const im of t.imgs) {
      const n = copyImage(im.src);
      if (n) content.push({ type: 'img', src: `/content/vi/images/${n}`, alt: im.alt || '' });
    }
  }

  // Khu "Giá chi tiết": chuyển đoạn nhiều dòng -> block list (Bao gồm / Không bao gồm)
  let curH2 = '';
  for (const t of tok2) {
    if (t.kind === 'h2') {
      curH2 = t.text;
      content.push({ type: 'h2', text: t.text });
      continue;
    }
    if (t.kind === 'img') {
      const n = copyImage(t.src);
      if (n) content.push({ type: 'img', src: `/content/vi/images/${n}`, alt: t.alt || '' });
      continue;
    }
    if (t.kind === 'p') {
      const lines = t.text.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length > 1) {
        content.push({ type: 'list', items: lines });
      } else if (t.text) {
        content.push({ type: 'p', text: t.text });
      }
    }
  }

  return { name, desc, content, itinerary, imgCount };
}

// ---------- Ghép vào file JSON ----------
function sanitizeSlug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/–|—/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function main() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const files = fs
    .readdirSync(TOURS_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(TOURS_DIR, f));

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  const order = Array.isArray(index.order) ? index.order : [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const base = path.basename(file, '.html');
    if (SKIP.has(base)) { skipped += 1; continue; }

    let slug = base;
    const existing = path.join(CONTENT_T, `${base}.json`);
    if (!fs.existsSync(existing)) {
      slug = sanitizeSlug(base);
    }

    const old = parseOldTour(file);
    if (!old.content.length) {
      console.log(`[skip] không có nội dung parse được: ${base}`);
      skipped += 1;
      continue;
    }

    const dest = path.join(CONTENT_T, `${slug}.json`);
    const cur = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, 'utf-8')) : {};

    const merged = {
      ...cur,
      slug: cur.slug || slug,
      name: cur.name || old.name,
      desc: cur.desc || old.desc,
      content: old.content,
      itinerary: old.itinerary.length ? old.itinerary : cur.itinerary || [],
    };
    // Tour mới: giá trị mặc định cho các trường còn thiếu
    merged.region = cur.region || 'domestic';
    merged.region_name = cur.region_name || '';
    merged.duration = cur.duration || '';
    merged.price = cur.price || '';
    merged.image = cur.image || (old.imgCount ? '' : '');
    merged.highlights = Array.isArray(cur.highlights) ? cur.highlights : [];

    fs.writeFileSync(dest, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

    if (!order.includes(slug)) { order.push(slug); added += 1; }
    else updated += 1;
    console.log(`[ok] ${base} -> ${slug} (${old.content.length} blocks, ${old.itinerary.length} ngày, ${old.imgCount} ảnh)`);
  }

  fs.writeFileSync(INDEX_PATH, JSON.stringify({ ...index, count: order.length, order }, null, 2) + '\n', 'utf-8');
  console.log(`\n[restore] done: ${updated} cập nhật, ${added} tour mới, ${skipped} bỏ qua. Tổng ${order.length} tour.`);
}

main();
