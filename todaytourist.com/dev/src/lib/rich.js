/**
 * rich.js — sanitize HTML an toàn cho render WYSIWYG (SunEditor) qua set:html.
 * Dùng cho các field "wysiwyg" ở Quản lý Trang (footer/header/giới thiệu/liên hệ).
 *
 * Module nằm trong src/lib/ nên KHÔNG bị copyLayout ghi đè (an toàn).
 */
import sanitizeHtml from 'sanitize-html';

export function richText(html) {
  return sanitizeHtml(html || '', {
    allowedTags: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'a',
      'ul', 'ol', 'li', 'h2', 'h3',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener nofollow', target: '_blank' }),
    },
  });
}

/**
 * richDoc — sanitize cho trang "Liên hệ 2" (full-document editor): cho phép
 * h1-h6, blockquote, pre, hr, bảng, ảnh, màu chữ (span style), v.v.
 */
export function richDoc(html) {
  return sanitizeHtml(html || '', {
    allowedTags: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'span', 'a',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'hr',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'img', 'div',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'style'],
      img: ['src', 'alt', 'style'],
      span: ['style'],
      div: ['style'],
      p: ['style'],
      ul: ['style'],
      ol: ['style'],
      li: ['style'],
      h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], h5: ['style'], h6: ['style'],
      th: ['colspan', 'rowspan', 'style'],
      td: ['colspan', 'rowspan', 'style'],
      table: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener nofollow', target: '_blank' }),
    },
  });
}
