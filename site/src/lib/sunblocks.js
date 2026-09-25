/**
 * sunblocks.js — WYSIWYG <-> content[] blocks converter.
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
import { formatBlock, list, link, image, font, fontSize, fontColor, hiliteColor, align, lineHeight, table, horizontalRule, textStyle, blockquote, video } from 'suneditor/src/plugins';
import { fileToImage, shrinkImageDataUrl, IMAGE_TARGET_BYTES } from '@/lib/admin.js';

/**
 * Nén + chuyển file (kéo thả/dán) thành data URL để preview trong editor.
 * Lỗi (ảnh quá lớn / định dạng không hỗ trợ) hiện thông báo cho admin thay vì
 * im lặng không chèn được ảnh (trước đây lỗi bị nuốt).
 */
async function fileToDataUrl(file) {
  try {
    const img = await fileToImage(file);
    if (!img) return null;
    const ext = (img.name.split('.').pop() || 'webp').toLowerCase();
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/webp';
    return `data:${mime};base64,${img.data}`;
  } catch (err) {
    const msg = err && err.message ? err.message : 'Lỗi xử lý ảnh.';
    if (typeof window !== 'undefined' && window.alert) window.alert(msg);
    return null;
  }
}

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

/** Thuộc tính style được phép giữ lại trên chữ INLINE (đậm/màu/cỡ chữ...). */
const INLINE_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'text-decoration',
]);

/** Thuộc tính style được phép trong KHỐI HTML giàu (bảng, khung nổi bật...). */
const BLOCK_STYLE_PROPS = new Set([
  ...INLINE_STYLE_PROPS,
  'background',
  'text-align',
  'line-height',
  'letter-spacing',
  'vertical-align',
  'white-space',
  'list-style-type',
  'width',
  'max-width',
  'min-width',
  'height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'border-collapse',
  'border-spacing',
  'table-layout',
]);

/**
 * Lọc 1 chuỗi style: chỉ giữ thuộc tính trong `allowed` và bỏ giá trị nguy hiểm
 * (url(...), expression(...), javascript:) — tránh admin dán HTML lạ làm hỏng trang.
 */
function cleanStyle(value, allowed) {
  const out = [];
  String(value || '')
    .split(';')
    .forEach((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return;
      const prop = decl.slice(0, i).trim().toLowerCase();
      const val = decl.slice(i + 1).trim();
      if (!prop || !val || !allowed.has(prop)) return;
      if (/url\s*\(|expression\s*\(|javascript:|\\/i.test(val)) return;
      out.push(`${prop}:${val}`);
    });
  return out.join(';');
}

const cleanInlineStyle = (v) => cleanStyle(v, INLINE_STYLE_PROPS);

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
        // Giữ màu chữ / cỡ chữ admin chọn (nút fontColor, fontSize trong thanh công cụ).
        const style = cleanInlineStyle(node.getAttribute('style'));
        [...node.attributes].forEach((a) => node.removeAttribute(a.name));
        if (style) node.setAttribute('style', style);
      }
      walk(node);
    });
  };
  walk(doc.body);
  return decodeEntities(doc.body.innerHTML);
}

/* ---------------- sanitize khối HTML giàu (bảng, khung, video) ---------------- */

/** Tag được giữ trong block `{type:'html'}` — bảng, tiêu đề, khung, video nhúng. */
const RICH_ALLOWED = new Set([
  'P', 'DIV', 'SPAN', 'BR', 'HR',
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'MARK', 'SMALL',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
  'BLOCKQUOTE', 'PRE', 'CODE',
  'A', 'IMG', 'FIGURE', 'FIGCAPTION',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION', 'COLGROUP', 'COL',
  'IFRAME', 'VIDEO', 'SOURCE',
]);

/** Thuộc tính được giữ theo từng tag (ngoài `style` đã lọc riêng). */
const RICH_ATTRS = {
  A: ['href', 'target', 'rel'],
  IMG: ['src', 'alt', 'width', 'height', 'loading'],
  IFRAME: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'title'],
  VIDEO: ['src', 'width', 'height', 'controls', 'poster', 'preload', 'playsinline', 'muted', 'loop'],
  SOURCE: ['src', 'type'],
  TD: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height'],
  TH: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height', 'scope'],
  TABLE: ['width', 'align'],
  OL: ['type', 'start'],
  COL: ['span', 'width'],
  COLGROUP: ['span', 'width'],
};

/** URL an toàn: http(s), mailto, tel, đường dẫn nội bộ, ảnh data URL. */
function safeUrl(value, allowData) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^\s*javascript:/i.test(v)) return '';
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (allowData && /^data:image\//i.test(v)) return v;
  if (/^(\/|#|\.)/.test(v)) return v; // '/content/...', '#anchor', './x.png'
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return v; // tên file tương đối (vd 'pasted-1.webp')
  return '';
}

/**
 * Lọc HTML giàu trước khi lưu: bảng, màu chữ, khung... được giữ; tag/attr lạ bị bỏ
 * (bỏ cả nội dung với script/style). Chỉ admin soạn nhưng vẫn chặn cho chắc.
 */
export function sanitizeRichHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div id="tt-rich-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('tt-rich-root');
  if (!root) return '';

  const sanitizeNode = (node) => {
    const tag = node.tagName.toUpperCase();
    if (!RICH_ALLOWED.has(tag)) {
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META' || tag === 'OBJECT' || tag === 'EMBED') {
        node.remove();
        return;
      }
      const kids = [...node.childNodes];
      node.replaceWith(...kids);
      kids.forEach((k) => {
        if (k.nodeType === 1) sanitizeNode(k);
      });
      return;
    }
    const allowed = RICH_ATTRS[tag] || [];
    [...node.attributes].forEach((a) => {
      const name = a.name.toLowerCase();
      if (name === 'style') {
        const style = cleanStyle(a.value, BLOCK_STYLE_PROPS);
        if (style) node.setAttribute('style', style);
        else node.removeAttribute(a.name);
        return;
      }
      if (!allowed.includes(name)) {
        node.removeAttribute(a.name);
        return;
      }
      if (name === 'src' || name === 'href' || name === 'poster') {
        const url = safeUrl(a.value, tag === 'IMG');
        if (url) node.setAttribute(name, url);
        else node.removeAttribute(a.name);
      }
    });
    if (tag === 'A' && node.getAttribute('href') && !/^#/.test(node.getAttribute('href'))) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener nofollow');
    }
    [...node.children].forEach(sanitizeNode);
  };

  [...root.children].forEach(sanitizeNode);
  return root.innerHTML;
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
      case 'html':
        // Khối HTML giàu (bảng, khung, video...) — giữ nguyên để sửa tiếp trong editor.
        if (b.html) parts.push(b.html);
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
  if (needsRichBlock(node)) {
    const html = sanitizeRichHtml(node.outerHTML);
    if (html) out.push({ type: 'html', html });
    return;
  }
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

/**
 * Phần tử cần giữ dạng HTML giàu thay vì quy về block chữ?
 *  - TABLE và mọi thứ chứa bảng (bảng, khung, video nhúng, blockquote, code...) đều
 *    KHÔNG biểu diễn được bằng block {p,h2,h3,img,list} nên nếu ép về chữ sẽ mất
 *    cấu trúc (đã từng bị: bảng thành 1 loạt đoạn văn rời).
 */
const RICH_KEEP = new Set(['TABLE', 'BLOCKQUOTE', 'PRE', 'IFRAME', 'VIDEO', 'FIGURE', 'DL']);

function needsRichBlock(node) {
  const tag = node.tagName ? node.tagName.toUpperCase() : '';
  if (RICH_KEEP.has(tag)) return true;
  return !!node.querySelector && !!node.querySelector('table, iframe, video');
}

/* ---------------- SunEditor instance ---------------- */

let editor = null;

// Toolbar cho từng field trong "Quản lý Trang": không có ảnh (tránh data URL
// phình to file JSON — worker không xử lý ảnh cho pages).
const FIELD_TOOLBAR = [
  ['undo', 'redo'],
  ['formatBlock'],
  ['bold', 'underline', 'italic'],
  ['list'],
  ['link'],
  ['removeFormat'],
];

/**
 * Tạo một SunEditor v2 độc lập cho một field (dùng trong Quản lý Trang).
 * Mỗi lần gọi tạo editor riêng gắn vào container #rootId; trả về instance.
 * KHÔNG được đặt container bên trong <form> (SunEditor tạo form dialog lồng nhau).
 */
export function createRichEditor(rootId, initialHtml, opts) {
  const root = document.getElementById(rootId);
  if (!root) return null;
  const ed = suneditor.create(root, {
    plugins: [formatBlock, list, link],
    height: (opts && opts.height) || '220px',
    defaultTag: 'p',
    formats: ['p', 'h2', 'h3'],
    buttonList: FIELD_TOOLBAR,
    placeholder: 'Nhập nội dung — bôi đen để bôi đậm/nghiêng, chọn kiểu tiêu đề, chèn link...',
  });
  if (initialHtml) ed.setContents(initialHtml);
  return ed;
}

/* ---------------- Full-document editor (trang "Liên hệ 2") ---------------- */

/**
 * Toolbar đầy đủ như chế độ soạn tài liệu của SunEditor.
 * DÙNG CHUNG cho mọi editor "nội dung phong phú": ô soạn thảo của Trang (vd Trang Tìm tour)
 * và ô "Nội dung phong phú" của Tour/Tin tức — để admin có cùng bộ nút (màu chữ, bảng...).
 */
const RICH_TOOLBAR = [
  ['undo', 'redo'],
  ['font', 'fontSize', 'formatBlock'],
  ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
  ['fontColor', 'hiliteColor', 'textStyle'],
  ['removeFormat'],
  ['outdent', 'indent'],
  ['align', 'list', 'lineHeight'],
  ['blockquote', 'horizontalRule'],
  ['table', 'link', 'image', 'video'],
  ['fullScreen', 'showBlocks', 'codeView'],
  ['print', 'preview', 'save'],
];

/** Plugin dùng cho editor nội dung phong phú (khớp RICH_TOOLBAR). */
const RICH_PLUGINS = [
  blockquote, align, font, fontSize, fontColor, hiliteColor, horizontalRule,
  list, table, formatBlock, lineHeight, textStyle, link, image, video,
];

const RICH_FORMATS = ['p', 'div', 'h2', 'h3', 'h4', 'blockquote', 'pre'];

/**
 * CSS dùng chung cho editor nội dung phong phú: nền vàng nhạt + kiểu Heading 3
 * (xanh thương hiệu, lớn hơn, kẻ mảnh bên dưới) để admin thấy đúng như ngoài trang.
 * Tiêm 1 lần cho cả trang (nhiều editor trên cùng trang vẫn chỉ có 1 thẻ style).
 */
function injectRichEditorCss() {
  if (typeof document === 'undefined' || document.getElementById('tt-rich-editor-css')) return;
  const style = document.createElement('style');
  style.id = 'tt-rich-editor-css';
  style.textContent = `
    /* Vùng soạn thảo nền vàng nhạt để dễ nhận biết ô "Nội dung phong phú". */
    .sun-editor.tt-rich-editor {
      background: #fffdf2;
      border: 1px solid #f0e3b8;
      border-radius: 0.9rem;
      overflow: hidden;
    }
    .sun-editor.tt-rich-editor .se-container,
    .sun-editor.tt-rich-editor .se-wrapper-inner,
    .sun-editor.tt-rich-editor .se-wrapper {
      background: #fffdf2;
    }
    /* Heading 3 cài sẵn kiểu: chữ xanh thương hiệu + lớn hơn + kẻ mảnh bên dưới,
       hiển thị như 1 khung nền vàng nhạt cho nổi bật (khớp trang ngoài). */
    .sun-editor.tt-rich-editor .se-wrapper-inner h3 {
      font-family: var(--font-display, inherit);
      font-size: 1.32rem !important;
      font-weight: 700;
      line-height: 1.35;
      color: #1c6b1f !important;
      background: #fdf6d3;
      border-bottom: 1px solid rgba(28, 107, 31, 0.35);
      border-radius: 6px 6px 0 0;
      padding: 0.5rem 0.75rem;
      margin: 1.5rem 0 0.75rem;
    }
  `;
  document.head.appendChild(style);
}

/**
 * SunEditor tạo DOM trong phần tử ANH EM có id `suneditor_<id gốc>` (container gốc
 * ở lại rỗng) → phải gắn class vào phần tử được tạo đó thì CSS mới áp dụng.
 */
function tagEditorShell(rootId) {
  if (typeof document === 'undefined') return;
  const shell = document.getElementById(`suneditor_${rootId}`);
  if (shell) shell.classList.add('tt-rich-editor');
}

/**
 * Tạo SunEditor chế độ document (nhiều button/option) cho trang có `fullEditor`.
 * Ảnh: onImageUpload nén WebP -> data URL preview; khi lưu collectFullHtmlImages
 * gom data: -> đẩy vào images[] (worker ghi /content/vi/images/) + thay bằng path.
 */
export function createFullEditor(rootId, initialHtml, opts) {
  const root = document.getElementById(rootId);
  if (!root) return null;
  const ed = suneditor.create(root, {
    plugins: RICH_PLUGINS,
    height: (opts && opts.height) || '520px',
    defaultTag: 'p',
    formats: RICH_FORMATS,
    buttonList: RICH_TOOLBAR,
    placeholder: 'Soạn thảo nội dung như một tài liệu — đầy đủ định dạng, bảng, ảnh, video...',
    image: {
      accept: 'image/*',
      imageSizeOnlyPercentage: true,
      size: '100%',
    },
    onImageUpload: async (files) => {
      const file = files && files[0];
      if (!file) return null;
      return fileToDataUrl(file);
    },
  });
  if (initialHtml) ed.setContents(initialHtml);
  return ed;
}

/** Thu thập ảnh data: base64 trong HTML full editor -> {name,data} + thay bằng /content/vi/images/<name>. */export function collectFullHtmlImages(html) {
  let images = [];
  let pasted = 0;
  const out = String(html || '').replace(
    /data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g,
    (m, ext, data) => {
      const e = ext === 'jpeg' ? 'jpg' : ext;
      const name = `lienhe2-${Date.now()}-${pasted++}.${e}`;
      images.push({ name, data });
      return `/content/vi/images/${name}`;
    },
  );
  return { html: out, images };
}

/**
 * Editor HTML cho "Chỉnh sửa HTML" (nội dung chính trang) — có nút codeView
 * để xem/sửa mã nguồn HTML. KHÔNG có nút ảnh (tránh data: base64 phình file JSON).
 */
export function createHtmlEditor(rootId, initialHtml, opts) {
  const root = document.getElementById(rootId);
  if (!root) return null;
  const ed = suneditor.create(root, {
    plugins: [formatBlock, list, link],
    height: (opts && opts.height) || '360px',
    defaultTag: 'p',
    formats: ['p', 'h2', 'h3'],
    buttonList: [
      ['undo', 'redo'],
      ['formatBlock'],
      ['bold', 'underline', 'italic'],
      ['list'],
      ['link'],
      ['removeFormat'],
      ['codeView'],
    ],
    placeholder: 'Chỉnh sửa HTML — bấm nút </> để xem mã nguồn...',
  });
  if (initialHtml) ed.setContents(initialHtml);
  return ed;
}

export function initSunEditor(rootId) {
  const root = document.getElementById(rootId);
  if (!root || editor) return editor;
  injectRichEditorCss();
  editor = suneditor.create(root, {
    // DÙNG CHUNG toolbar với ô soạn thảo của Trang (vd Trang Tìm tour): có màu chữ,
    // tô nền, bảng, căn lề, blockquote... để 2 nơi soạn giống nhau.
    plugins: RICH_PLUGINS,
    height: '460px',
    defaultTag: 'p',
    formats: RICH_FORMATS,
    buttonList: RICH_TOOLBAR,
    placeholder:
      'Nhập nội dung — bôi đen để định dạng, chọn Heading 3 để có khung nổi bật, kéo thả ảnh...',
    image: {
      accept: 'image/*',
      imageSizeOnlyPercentage: true,
      size: '100%',
    },
    // v2: trả về URL string -> SunEditor chèn <img src=URL>. Dùng data URL (đã nén)
    // để preview hiện ngay; khi lưu sunCollectBlocks đọc data: -> đẩy vào images[].
    onImageUpload: async (files) => {
      const file = files && files[0];
      if (!file) return null;
      return fileToDataUrl(file);
    },
  });
  // SunEditor gắn DOM vào phần tử anh em `suneditor_<id>` → gắn class vào đó.
  tagEditorShell(rootId);
  return editor;
}

export function sunSetBlocks(blocks) {
  if (editor) editor.setContents(blocksToHtml(blocks));
}

export function sunGetHtml() {
  return editor ? editor.getContents() : '';
}

/**
 * Đổi 1 data URL ảnh thành file gửi kèm worker: nén nếu quá lớn, trả {name,data}
 * hoặc null nếu bỏ (kèm ghi nhận để báo admin).
 */
async function dataUrlToImage(dataUrl, prefix, stats) {
  const m = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!m) return null;
  let data = m[2];
  let ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > IMAGE_TARGET_BYTES) {
    try {
      const small = await shrinkImageDataUrl(dataUrl);
      if (!small?.data) throw new Error('shrink failed');
      data = small.data;
      ext = (small.name?.split('.').pop() || ext).toLowerCase();
      stats.shrunk.push(Math.round((bytes / 1024 / 1024) * 10) / 10);
    } catch {
      stats.skipped.push(Math.round((bytes / 1024 / 1024) * 10) / 10);
      return null;
    }
  }
  const name = `${prefix}-${Date.now()}-${stats.count++}.${ext}`;
  return { name, data };
}

/**
 * Gom ảnh data: nằm BÊN TRONG block HTML giàu (bảng, khung...) — thay bằng đường dẫn
 * ĐẦY ĐỦ `/content/vi/images/<tên>`.
 *
 * ⚠️ Khác với block `img`: worker tự đổi `src` tương đối -> `/content/vi/images/...`
 * khi lưu, còn chuỗi HTML thì worker KHÔNG sửa (giữ nguyên) — nên phải ghi sẵn
 * đường dẫn đầy đủ ngay ở đây, nếu không ảnh trong bảng sẽ hỏng ngoài trang.
 */
async function extractBlockImages(html, stats) {
  const out = [];
  let result = '';
  let rest = String(html || '');
  for (;;) {
    const m = rest.match(/src="(data:image\/[^"]+)"/i);
    if (!m) break;
    const idx = m.index ?? 0;
    result += rest.slice(0, idx);
    const img = await dataUrlToImage(m[1], 'pasted', stats);
    result += img ? `src="/content/vi/images/${img.name}"` : 'src=""';
    if (img) out.push(img);
    rest = rest.slice(idx + m[0].length);
  }
  return { html: result + rest, images: out };
}

/**
 * Thu thập từ WYSIWYG: parse HTML -> blocks[] + gom ảnh mới vào images[].
 *  - src data:image/... (ảnh vừa kéo thả/đánh dán) -> tạo tên + đẩy base64 vào images[]
 *  - src bắt đầu bằng / hoặc http (ảnh cũ) -> giữ nguyên, không tải lại
 *  - ảnh nằm trong khối HTML giàu (bảng...) cũng được gom theo
 * Ảnh dán vào quá lớn được TỰ ĐỘNG nén lại về mức an toàn (shrinkImageDataUrl);
 * chỉ bỏ khi trình duyệt không giải mã/nén được (kèm cảnh báo) — thay vì để server
 * trả lỗi làm hỏng cả lần lưu.
 */
export async function sunCollectBlocks() {
  const blocks = htmlToBlocks(sunGetHtml());
  const images = [];
  const kept = [];
  const stats = { shrunk: [], skipped: [], count: 0 };

  for (const b of blocks) {
    if (b.type === 'html') {
      // Ảnh dán vào BÊN TRONG bảng/khung cũng phải được đẩy lên worker.
      const res = await extractBlockImages(b.html, stats);
      images.push(...res.images);
      kept.push({ ...b, html: res.html });
      continue;
    }
    if (b.type !== 'img') {
      kept.push(b);
      continue;
    }
    const src = b.src || '';
    if (!/^data:image\//i.test(src)) {
      kept.push(b);
      continue;
    }
    const img = await dataUrlToImage(src, 'pasted', stats);
    if (!img) continue; // data URL lỗi / ảnh quá lớn không nén được -> bỏ block ảnh rỗng
    images.push(img);
    b.src = img.name;
    kept.push(b);
  }

  if (stats.shrunk.length) {
    console.info(`[admin] tự giảm ${stats.shrunk.length} ảnh lớn trong nội dung: ${stats.shrunk.join('MB, ')}MB`);
  }
  if (stats.skipped.length && typeof window !== 'undefined' && window.alert) {
    window.alert(
      `Đã bỏ ${stats.skipped.length} ảnh trong nội dung vì không nén được (${stats.skipped.join('MB, ')}MB). ` +
        'Các nội dung khác vẫn được lưu.',
    );
  }
  return { content: kept, images };
}
