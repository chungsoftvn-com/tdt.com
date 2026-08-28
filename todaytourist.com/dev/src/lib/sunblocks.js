/**
 * sunblocks.js — WYSIWYG (SunEditor) <-> content[] blocks converter.
 *
 * Lưu trữ VẪN là mảng block `content[]` ({type: p|h2|h3|img|list}) để worker,
 * translate.py, RichContent và bản EN giữ nguyên. SunEditor chỉ là mặt nạ
 * soạn thảo: khi mở bài -> blocks -> HTML đổ vào editor; khi lưu -> parse
 * HTML -> blocks (giống hệt format cũ).
 *
 * Inline formatting (đậm/nghiêng/gạch chân/link) bên trong đoạn văn được giữ
 * dưới dạng inline HTML an toàn trong `text` (sanitize allowlist).
 *
 * Ảnh: `onImageUpload` nén WebP (fileToImage) -> chèn `<img src="<tên>">`
 * (tên tương đối) + đưa vào pendingImages. Khi lưu, collectSunBlocks đẩy
 * {name, data} vào `images[]` — worker map src tương đối -> /content/vi/images/<tên>
 * và ghi file. Ảnh cũ (src bắt đầu bằng / hoặc http) giữ nguyên, không tải lại.
 *
 * Module nằm trong src/lib/ nên KHÔNG bị copyLayout ghi đè (an toàn).
 */
import 'suneditor/dist/css/suneditor.min.css'; // UI editor (v2)
import suneditor from 'suneditor';
import { formatBlock, list, link, image } from 'suneditor/src/plugins';
import { fileToImage } from '@/lib/admin.js';

/* ---------------- escape / sanitize ---------------- */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Chỉ cho phép inline tag an toàn; bỏ tag/attr khác (chỉ admin dùng, nhưng chặn chắc). */
const ALLOWED_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'BR', 'SPAN']);

function sanitizeInline(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (el) => {
    [...el.childNodes].forEach((node) => {
      if (node.nodeType !== 1) return; // text node giữ nguyên
      const tag = node.tagName.toUpperCase();
      if (!ALLOWED_INLINE.has(tag)) {
        node.replaceWith(document.createTextNode(node.textContent));
        return;
      }
      if (tag === 'A') {
        const href = node.getAttribute('href') || '';
        [...node.attributes].forEach((a) => node.removeAttribute(a.name));
        if (href && !/^\s*javascript:/i.test(href)) {
          node.setAttribute('href', href);
          if (!/^#/.test(href)) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener nofollow');
          }
        }
      } else {
        [...node.attributes].forEach((a) => node.removeAttribute(a.name));
      }
      walk(node);
    });
  };
  walk(doc.body);
  return decodeEntities(doc.body.innerHTML);
}

/* ---------------- blocks -> HTML (loader) ---------------- */

export function blocksToHtml(blocks) {
  const parts = [];
  for (const b of blocks || []) {
    if (!b) continue;
    switch (b.type) {
      case 'img':
        parts.push(`<p><img src="${esc(b.src)}" alt="${esc(b.alt)}" /></p>`);
        break;
      case 'list':
        parts.push(
          `<ul>${(b.items || []).map((it) => `<li>${esc(it)}</li>`).join('')}</ul>`,
        );
        break;
      case 'h2':
      case 'h3':
        parts.push(
          `<${b.type}>${b.text && b.text.includes('<') ? sanitizeInline(b.text) : esc(b.text)}</${b.type}>`,
        );
        break;
      case 'p':
        parts.push(
          `<p>${b.text && b.text.includes('<') ? sanitizeInline(b.text) : esc(b.text)}</p>`,
        );
        break;
      default:
        break;
    }
  }
  return parts.join('\n');
}

/* ---------------- HTML -> blocks (saver) ---------------- */

function pushText(out, type, innerHtml) {
  const text = (innerHtml || '').trim();
  if (text && text !== '<br>') out.push({ type, text: sanitizeInline(text) });
}

function walk(node, out) {
  const tag = node.tagName ? node.tagName.toUpperCase() : '';
  if (tag === 'IMG') {
    out.push({ type: 'img', src: node.getAttribute('src') || '', alt: node.getAttribute('alt') || '' });
    return;
  }
  if (tag === 'P') {
    const imgs = node.querySelectorAll('img');
    if (imgs.length) {
      let html = node.innerHTML;
      imgs.forEach((img) => {
        const outer = img.outerHTML;
        const idx = html.indexOf(outer);
        if (idx > -1) {
          pushText(out, 'p', html.slice(0, idx));
          out.push({ type: 'img', src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '' });
          html = html.slice(idx + outer.length);
        }
      });
      pushText(out, 'p', html);
      return;
    }
    pushText(out, 'p', node.innerHTML);
    return;
  }
  if (tag === 'H1' || tag === 'H2') {
    pushText(out, 'h2', node.innerHTML);
    return;
  }
  if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
    pushText(out, 'h3', node.innerHTML);
    return;
  }
  if (tag === 'UL' || tag === 'OL') {
    const items = [...node.children]
      .filter((c) => c.tagName === 'LI')
      .map((li) => li.textContent.trim())
      .filter(Boolean);
    if (items.length) out.push({ type: 'list', items });
    return;
  }
  // wrapper khác (DIV, FIGURE, SECTION, BLOCKQUOTE...) -> đệ quy
  [...node.childNodes].forEach((c) => {
    if (c.nodeType === 1) walk(c, out);
    else if (c.nodeType === 3 && c.textContent.trim()) out.push({ type: 'p', text: c.textContent.trim() });
  });
}

export function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const out = [];
  [...doc.body.childNodes].forEach((c) => {
    if (c.nodeType === 1) walk(c, out);
    else if (c.nodeType === 3 && c.textContent.trim()) out.push({ type: 'p', text: c.textContent.trim() });
  });
  return out;
}

/* ---------------- SunEditor instance ---------------- */

let editor = null;

const TOOLBAR = [
  ['undo', 'redo'],
  ['formatBlock'],
  ['bold', 'underline', 'italic'],
  ['list'],
  ['link', 'image'],
  ['removeFormat'],
];

export function initSunEditor(rootId) {
  const root = document.getElementById(rootId);
  if (!root || editor) return editor;
  editor = suneditor.create(root, {
    plugins: [formatBlock, list, link, image],
    height: '460px',
    defaultTag: 'p',
    formats: ['p', 'h2', 'h3'],
    buttonList: TOOLBAR,
    placeholder: 'Nhập nội dung — bôi đen để bôi đậm/nghiêng, chọn kiểu tiêu đề, kéo thả ảnh...',
    image: {
      accept: 'image/*',
      imageSizeOnlyPercentage: true,
      size: '100%',
    },
    // v2: trả về URL string -> SunEditor chèn <img src=URL>. Dùng data URL WebP
    // (đã nén) để preview hiện ngay; khi lưu sunCollectBlocks đọc data: -> đẩy vào images[].
    onImageUpload: async (files) => {
      const file = files && files[0];
      if (!file) return null;
      const img = await fileToImage(file);
      if (!img) return null;
      return `data:image/webp;base64,${img.data}`;
    },
  });
  return editor;
}

export function sunSetBlocks(blocks) {
  if (editor) editor.setContents(blocksToHtml(blocks));
}

export function sunGetHtml() {
  return editor ? editor.getContents() : '';
}

/**
 * Thu thập từ WYSIWYG: parse HTML -> blocks[] + gom ảnh mới vào images[].
 *  - src data:image/... (ảnh vừa kéo thả/đánh dán) -> tạo tên + đẩy base64 vào images[]
 *  - src bắt đầu bằng / hoặc http (ảnh cũ) -> giữ nguyên, không tải lại
 */
export async function sunCollectBlocks() {
  const blocks = htmlToBlocks(sunGetHtml());
  const images = [];
  let pasted = 0;
  for (const b of blocks) {
    if (b.type !== 'img') continue;
    const src = b.src || '';
    if (/^data:image\//i.test(src)) {
      const m = src.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s);
      if (m) {
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        const name = `pasted-${Date.now()}-${pasted++}.${ext}`;
        images.push({ name, data: m[2] });
        b.src = name;
      } else {
        b.src = '';
      }
    }
  }
  return { content: blocks, images };
}
