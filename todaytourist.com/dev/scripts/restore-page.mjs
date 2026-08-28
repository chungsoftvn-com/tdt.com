#!/usr/bin/env node
/**
 * Khôi phục 1 trang tĩnh CŨ (HTML) -> content/vi/<slug>.json dạng rich content.
 *
 * Cách chạy:
 *   node scripts/restore-page.mjs <file-html> <slug> [hero_kicker]
 *   vd: node scripts/restore-page.mjs dai-ly-ve-may-bay-todaytourist.html ve-may-bay "Vé máy bay"
 *
 * Kết quả JSON:
 *   { title, hero_kicker, hero_title, hero_text, content: [p|h2|h3|img|list] }
 * Ảnh: copy vào public/content/vi/images/ (nếu có file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = path.join(ROOT, 'downloads', 'old', 'todaytourist.com');
const IMG_DIR = path.join(ROOT, 'public', 'content', 'vi', 'images');

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
    .replace(/[ \t]+/g, ' ')
    .trim();
}

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
    const src = (m[0].match(/src\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    const alt = (m[0].match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    if (src) out.push({ src: decodeEntities(src), alt: decodeEntities(alt) });
  }
  return out;
}

function tokenize(html) {
  const tokens = [];
  const re = /<(h1|h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === 'i') {
      const tag = m[0];
      tokens.push({
        kind: 'img',
        src: decodeEntities((tag.match(/src\s*=\s*["']([^"']*)["']/i) || [])[1] || ''),
        alt: decodeEntities((tag.match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1] || ''),
      });
    } else {
      tokens.push({ kind: m[1], text: toText(m[2]), imgs: imgsOf(m[2]) });
    }
  }
  return tokens;
}

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

// ---------- Main ----------
function main() {
  const [, , fileArg, slugArg, kickerArg] = process.argv;
  if (!fileArg || !slugArg) {
    console.error('Cách dùng: node scripts/restore-page.mjs <file.html> <slug> [hero_kicker]');
    process.exit(1);
  }
  const file = path.join(OLD, fileArg);
  if (!fs.existsSync(file)) {
    console.error('Không thấy file: ' + file);
    process.exit(1);
  }
  fs.mkdirSync(IMG_DIR, { recursive: true });

  const html = fs.readFileSync(file, 'utf-8');
  // Tiêu đề từ label của trang ASP.NET
  const title =
    (html.match(/lblTitle["']?\s*>([^<]*)</i) || [])[1]?.trim() ||
    (html.match(/<title>\s*([\s\S]*?)\s*<\/title>/i) || [])[1]?.trim() ||
    slugArg;

  // Vùng nội dung bài viết: từ lblDetail đến hết bài (dừng trước "Chia sẻ"/clear)
  const i0 = html.indexOf('lblDetail');
  const i1 = html.indexOf('clear: both', i0);
  const region = html.slice(i0, i1 > -1 ? i1 : undefined);

  const content = [];
  let heroText = '';
  let imgCount = 0;
  for (const t of tokenize(region)) {
    if (t.kind === 'img') {
      const n = copyImage(t.src);
      if (n) content.push({ type: 'img', src: `/content/vi/images/${n}`, alt: t.alt || '' });
      imgCount += 1;
      continue;
    }
    if (t.kind === 'h1') continue;
    if (t.kind === 'h2') { content.push({ type: 'h2', text: t.text }); continue; }
    if (t.kind === 'h3') { content.push({ type: 'h3', text: t.text }); continue; }
    // p — giữ nguyên xuống dòng (RichContent render với white-space: pre-line)
    if (!heroText && t.text.length > 30) heroText = t.text.split('\n')[0];
    if (t.text) content.push({ type: 'p', text: t.text });
    for (const im of t.imgs) {
      const n = copyImage(im.src);
      if (n) content.push({ type: 'img', src: `/content/vi/images/${n}`, alt: im.alt || '' });
    }
  }

  const data = {
    title,
    hero_kicker: kickerArg || title,
    hero_title: title,
    hero_text: heroText,
    content,
  };
  const dest = path.join(ROOT, 'content', 'vi', `${slugArg}.json`);
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`[restore-page] ${fileArg} -> ${dest} (${content.length} blocks, ${imgCount} ảnh)`);
}

main();
