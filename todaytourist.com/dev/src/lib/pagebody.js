/**
 * pagebody.js — trả về nội dung chính (body) của một trang để soạn thảo/render.
 *
 * - Nếu trang đã có bodyKey (vd "body_html") -> dùng thẳng (admin đã lưu qua editor).
 * - Ngược lại gộp từ các field cũ (bodyFallback) để giữ nội dung hiện tại
 *   (backward-compat + bản EN: en không có body_html, gộp từ en p1..p4...).
 *
 * Module nằm trong src/lib/ nên KHÔNG bị copyLayout ghi đè (an toàn).
 */
import { PAGE_SCHEMAS } from './pageschema.js';

function asHtml(v, tag) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (tag) return `<${tag}>${s}</${tag}>`;
  return s.startsWith('<') ? s : `<p>${s}</p>`;
}

export function bodyFor(pageKey, data, key) {
  const schema = PAGE_SCHEMAS[pageKey];
  if (!schema || !data) return '';
  const k = key || schema.bodyKey;
  if (k) {
    const html = data[k];
    if (html && String(html).trim()) return String(html);
  }
  // Chỉ fallback cho body chính (các body phụ của trang không có fallback)
  if (!key) {
    const parts = (schema.bodyFallback || []).map((it) =>
      typeof it === 'string' ? asHtml(data[it]) : asHtml(data[it.key], it.tag),
    );
    return parts.filter(Boolean).join('\n');
  }
  return '';
}
