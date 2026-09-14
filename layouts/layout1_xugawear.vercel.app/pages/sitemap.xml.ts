// /sitemap.xml — sinh lúc build từ chính dữ liệu content/.
//
// Vì sao tự viết thay vì dùng @astrojs/sitemap: site build hoàn toàn tĩnh và mọi
// trang đều đã có trong content/ (PAGE_SLUGS + tours + news + testimonials).
// Tự sinh giúp kiểm soát tuyệt đối việc LOẠI trừ: /admin/**, /vi/home/generated/
// và '/' (bản trùng của '/vi/' — xem canonicalPath trong lib/seo.js).
//
// Không phát <lastmod>: CI checkout ghi mọi file cùng một mtime nên lastmod sẽ
// SAI (Google bỏ qua hoặc giảm tin cậy nếu lastmod không chính xác).
import type { APIRoute } from 'astro';
import { LANGS, PAGE_SLUGS, getNews, getTestimonials, getTours } from '@/lib/content.js';
import { DEFAULT_LANG, absUrl, altPath } from '@/lib/seo.js';

export const prerender = true;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Tất cả path công khai được index, cho cả 2 ngôn ngữ.
 *
 * Slug lấy từ bản 'vi' cho CẢ 2 ngôn ngữ — y hệt `getStaticPaths()` trong
 * `src/pages/[lang]/tour/[slug].astro`, `[lang]/tin-tuc/[slug].astro`,
 * `[lang]/y-kien-khach-hang/[slug].astro` (slug độc lập ngôn ngữ).
 *
 * Bắt buộc phải khớp router: nếu lấy slug theo từng ngôn ngữ, một bài chỉ có
 * ở bản EN (vd testimonials khi content/vi rỗng) sẽ vào sitemap dù KHÔNG có
 * trang nào được build → Google nhận 404 từ sitemap.
 */
function collectPaths() {
  const paths = new Set();
  const tourSlugs = getTours('vi').map((t: { slug: string }) => t.slug);
  const newsSlugs = getNews('vi').map((n: { slug: string }) => n.slug);
  const testimonialSlugs = getTestimonials('vi').map((x: { slug: string }) => x.slug);

  for (const lang of LANGS) {
    paths.add(`/${lang}/`);
    for (const page of PAGE_SLUGS) paths.add(`/${lang}/${page}/`);
    paths.add(`/${lang}/tin-tuc/`);
    for (const slug of tourSlugs) paths.add(`/${lang}/tour/${slug}/`);
    for (const slug of newsSlugs) paths.add(`/${lang}/tin-tuc/${slug}/`);
    for (const slug of testimonialSlugs) paths.add(`/${lang}/y-kien-khach-hang/${slug}/`);
  }
  return [...paths].sort();
}

export const GET: APIRoute = () => {
  const urls = collectPaths().map((path) => {
    const lines = [`    <loc>${escapeXml(absUrl(path))}</loc>`];
    for (const lang of LANGS) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(absUrl(altPath(path, lang)))}"/>`,
      );
    }
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absUrl(altPath(path, DEFAULT_LANG)))}"/>`,
    );
    return ['  <url>', ...lines, '  </url>'].join('\n');
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
