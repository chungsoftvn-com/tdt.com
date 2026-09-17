import fs from 'node:fs';
import path from 'node:path';

/**
 * Content helpers — all website text lives in flat key:value JSON files
 * under `content/<lang>/*.json`. This module is the ONLY way pages read
 * that content, so no text is ever hard-coded in Astro.
 */

export const LANGS = ['vi', 'en'];
export const DEFAULT_LANG = 'vi';
/** Static sub-page slugs rendered by `[lang]/[page].astro`. */
export const PAGE_SLUGS = [
  'about',
  'tours',
  'contact',
  've-may-bay',
  'cho-thue-xe',
  'y-kien-khach-hang',
  'doi-tac',
  'dat-tour',
  'tim-tour',
  'tuyen-dung',
  'chi-duong',
];

/**
 * Trang CHỈ có bản VI và nằm ở CẤP GỐC: '/<slug>/' (KHÔNG có tiền tố ngôn ngữ,
 * cũng không có URL '/vi/<slug>/' hay '/en/<slug>/').
 *
 *   key   = slug trên URL cấp gốc
 *   value = slug trang tương đương trong PAGE_SLUGS (nguồn nội dung + bản dịch EN)
 *
 * Một trang cấp gốc là file `pages/<slug>.astro` dùng lại component của trang
 * tương đương (thường đọc cùng file content) nên nội dung luôn khớp nhau.
 *
 * Registry này là nguồn duy nhất để biết "cấp gốc", dùng ở 3 chỗ:
 *  - hreflang (lib/seo.js `alternates()`): KHÔNG phát '/en/<slug>/' → URL 404.
 *  - nút đổi ngôn ngữ ở header (langHref): đưa khách sang bản tương đương
 *    ('/vi/cho-thue-xe/', '/en/cho-thue-xe/') thay vì URL không tồn tại.
 *  - sitemap.xml.ts: thêm chính URL cấp gốc đó vào sitemap (chỉ 1 hreflang).
 */
export const ROOT_PAGE_EQUIV = {
  'dich-vu-cho-thue-xe-gia-tot-tai-dong-nai-tp-hcm': 'cho-thue-xe',
};

/**
 * Nếu pathname chỉ là MỘT trang VI-only ở cấp gốc → trả slug cấp gốc, ngược lại null.
 * '/dich-vu-a-b-c/' → 'dich-vu-a-b-c';  '/vi/dich-vu-a-b-c/' → null.
 */
export function viOnlyRootSlug(pathname) {
  const seg = String(pathname || '/').split('/').filter(Boolean);
  return seg.length === 1 && ROOT_PAGE_EQUIV[seg[0]] ? seg[0] : null;
}

const cache = new Map();

/** Load a flat JSON content file for a language, e.g. getContent('vi', 'home'). */
export function getContent(lang, file) {
  const key = `${lang}/${file}`;
  // Ở DEV: luôn đọc file mới (admin sửa content -> xem được ngay, không cần restart).
  // Ở PRODUCTION build: cache theo tiến trình (mỗi deploy là tiến trình mới nên vẫn đúng).
  if (!import.meta.env.DEV && cache.has(key)) return cache.get(key);
  const p = path.join(process.cwd(), '..', 'content', lang, `${file}.json`);
  const raw = fs.readFileSync(p, 'utf-8');
  const data = JSON.parse(raw);
  cache.set(key, data);
  return data;
}

/** Build a localized internal link: '/vi/', '/vi/tours/', '/en/tour/slug/'.
 *
 * LUÔN có '/' ở cuối: `astro.config.mjs` dùng `build.format: 'directory'`, nên
 * '/vi/tours' bị GitHub Pages trả 301 → '/vi/tours/'. Link thiếu '/' khiến mỗi
 * lượt click nội bộ tốn 1 redirect (hại crawl budget + tốc độ). */
export function href(lang, slug = '') {
  return slug ? `/${lang}/${String(slug).replace(/^\/+|\/+$/g, '')}/` : `/${lang}/`;
}

/**
 * Alternate-language URL for the current path, so the VI/EN switch keeps
 * the visitor on the same page. e.g. '/vi/tour/x/' -> '/en/tour/x/'.
 *
 * Cũng phải có '/' cuối (xem `href()`): thiếu '/' thì mỗi lần bấm nút đổi ngôn
 * ngữ tốn 1 redirect 301.
 */
export function langHref(lang, current) {
  // Trang VI-only ở cấp gốc không có '/<lang>/<slug>/' → trỏ sang trang tương đương
  // (xem ROOT_PAGE_EQUIV), tránh link 404 khi khách bấm nút đổi ngôn ngữ.
  const root = viOnlyRootSlug(current);
  if (root) return href(lang, ROOT_PAGE_EQUIV[root]);
  const seg = String(current || '/').split('/').filter(Boolean);
  if (seg[0] === 'vi' || seg[0] === 'en') seg[0] = lang;
  else seg.unshift(lang);
  return `/${seg.join('/')}/`;
}

/** Đọc 1 file bài viết dạng `content/<lang>/<kind>/<slug>.json` (null nếu thiếu). */
function readArticle(lang, kind, slug) {
  try {
    return getContent(lang, `${kind}/${slug}`);
  } catch {
    return null;
  }
}

function normalizeTour(t, slug) {
  return {
    slug: t.slug ?? slug,
    name: t.name ?? '',
    region: t.region ?? 'domestic',
    regionName: t.region_name ?? '',
    departure: t.departure ?? '',
    duration: t.duration ?? '',
    price: t.price ?? '',
    image: t.image ?? '',
    desc: t.desc ?? '',
    highlights: Array.isArray(t.highlights) ? t.highlights : [],
    itinerary: Array.isArray(t.itinerary) ? t.itinerary : [],
    content: Array.isArray(t.content) ? t.content : [],
  };
}

/** All tours for a language — index.order + 1 file/article (cấu trúc mới). */
export function getTours(lang) {
  const t = getContent(lang, 'tours');
  if (Array.isArray(t.order)) {
    return t.order
      .map((slug) => {
        const article = readArticle(lang, 'tours', slug);
        return article ? normalizeTour(article, slug) : null;
      })
      .filter(Boolean);
  }
  // Legacy fallback (chưa migrate): index phẳng tour_N_*
  const count = Number(t.count) || 0;
  const tours = [];
  for (let i = 1; i <= count; i += 1) {
    const slug = t[`tour_${i}_slug`] ?? '';
    if (!slug) continue;
    tours.push({
      slug,
      name: t[`tour_${i}_name`] ?? '',
      region: t[`tour_${i}_region`] ?? 'domestic',
      regionName: t[`tour_${i}_region_name`] ?? '',
      duration: t[`tour_${i}_duration`] ?? '',
      price: t[`tour_${i}_price`] ?? '',
      image: t[`tour_${i}_image`] ?? '',
      desc: t[`tour_${i}_desc`] ?? '',
      highlights: String(t[`tour_${i}_highlights`] ?? '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean),
      itinerary: [],
    });
  }
  return tours;
}

/** Find a single tour by slug for a language (null if not found). */
export function getTour(lang, slug) {
  const article = readArticle(lang, 'tours', slug);
  return article ? normalizeTour(article, slug) : getTours(lang).find((x) => x.slug === slug) ?? null;
}

/** All news for a language (mới nhất trước). */
export function getNews(lang) {
  const n = getContent(lang, 'news');
  const order = Array.isArray(n.order) ? n.order : [];
  return order
    .map((slug) => readArticle(lang, 'news', slug))
    .filter(Boolean)
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
}

/** Một bài tin (title, category, image, summary, body, published_at, content[]). */
export function getNewsItem(lang, slug) {
  const n = readArticle(lang, 'news', slug);
  if (!n) return null;
  return { ...n, content: Array.isArray(n.content) ? n.content : [] };
}

/** Ý kiến khách hàng: index { count, order, items }. Trả mảng theo thứ tự (kèm slug). */
export function getTestimonials(lang) {
  const d = getContent(lang, 'testimonials');
  const order = Array.isArray(d.order) ? d.order : [];
  const items = d.items && typeof d.items === 'object' ? d.items : {};
  return order.map((slug) => (items[slug] ? { ...items[slug], slug } : null)).filter(Boolean);
}

/** Đọc 1 ý kiến khách hàng theo slug (null nếu không có). */
export function getTestimonial(lang, slug) {
  const items = getTestimonials(lang);
  return items.find((x) => x.slug === slug) || null;
}

/** Đối tác: index { count, order, items }. Trả mảng theo thứ tự (kèm slug). */
export function getPartners(lang) {
  const d = getContent(lang, 'partners');
  const order = Array.isArray(d.order) ? d.order : [];
  const items = d.items && typeof d.items === 'object' ? d.items : {};
  return order.map((slug) => (items[slug] ? { ...items[slug], slug } : null)).filter(Boolean);
}
