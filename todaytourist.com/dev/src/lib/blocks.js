/**
 * Block editor — nội dung phong phú (ảnh + chữ đan xen) cho Admin.
 * Dùng chung cho form Tour & Tin tức (không bị copyLayout ghi đè — an toàn).
 * State: mảng block. Block img mang { file: File } để nén WebP khi save.
 */
import { fileToImage } from '@/lib/admin.js';

const LABELS = { p: 'Đoạn văn', h2: 'Tiêu đề lớn', h3: 'Tiêu đề nhỏ', img: 'Ảnh', list: 'Danh sách' };

let root = null;
let state = [];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function makeBlock(type) {
  if (type === 'img') return { type, src: '', alt: '', file: null, preview: '' };
  if (type === 'list') return { type, items: [] };
  return { type, text: '' };
}

function textareaOf(value, oninput, rows) {
  const ta = el('textarea', 'w-full rounded-xl border border-ink/15 bg-sand px-3 py-2.5 text-sm text-ink outline-none focus:border-sea');
  ta.rows = rows || 3;
  ta.value = value || '';
  ta.addEventListener('input', oninput);
  return ta;
}

function renderBlock(b, i) {
  const card = el('div', 'rounded-2xl border border-ink/10 bg-sand/40 p-3');
  const head = el('div', 'mb-2 flex items-center justify-between gap-2');
  const left = el('div', 'flex items-center gap-2');
  left.appendChild(el('span', 'rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-sand', LABELS[b.type] || b.type));
  left.appendChild(el('span', 'text-[11px] text-ink-soft', `#${i + 1}`));
  const controls = el('div', 'flex items-center gap-1');
  const mkBtn = (label, onClick) => {
    const btn = el('button', 'rounded-full border border-ink/15 px-2 py-0.5 text-[11px] text-ink hover:bg-ink hover:text-sand', label);
    btn.type = 'button';
    btn.addEventListener('click', onClick);
    return btn;
  };
  controls.appendChild(mkBtn('↑', () => move(i, -1)));
  controls.appendChild(mkBtn('↓', () => move(i, 1)));
  controls.appendChild(mkBtn('Xoá', () => { state.splice(i, 1); render(); }));
  head.appendChild(left);
  head.appendChild(controls);
  card.appendChild(head);

  const body = el('div', 'space-y-2');
  if (b.type === 'img') {
    const row = el('div', 'flex items-center gap-3');
    const file = el('input', 'w-full text-xs text-ink-soft');
    file.type = 'file';
    file.accept = 'image/*';
    file.addEventListener('change', () => {
      b.file = file.files[0] || null;
      if (b.file) {
        b.preview = URL.createObjectURL(b.file);
        b.src = (b.file.name || 'image').toLowerCase().replace(/\.[^.]+$/, '') + '.webp';
        render();
      }
    });
    row.appendChild(file);
    body.appendChild(row);
    const alt = el('input', 'w-full rounded-xl border border-ink/15 bg-sand px-3 py-2 text-xs text-ink outline-none focus:border-sea');
    alt.placeholder = 'Chú thích ảnh (alt)';
    alt.value = b.alt || '';
    alt.addEventListener('input', () => { b.alt = alt.value; });
    body.appendChild(alt);
    if (b.preview || b.src) {
      const img = document.createElement('img');
      img.src = b.preview || b.src;
      img.className = 'h-32 w-full rounded-lg object-cover';
      img.alt = '';
      body.appendChild(img);
    }
  } else if (b.type === 'list') {
    const ta = textareaOf((b.items || []).join('\n'), (e) => { b.items = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean); }, 4);
    ta.placeholder = 'Mỗi dòng 1 mục';
    body.appendChild(ta);
  } else {
    const ta = textareaOf(b.text, (e) => { b.text = e.target.value; }, b.type === 'p' ? 3 : 1);
    ta.placeholder = b.type === 'p' ? 'Nội dung đoạn văn' : 'Tiêu đề';
    body.appendChild(ta);
  }
  card.appendChild(body);
  return card;
}

function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= state.length) return;
  [state[i], state[j]] = [state[j], state[i]];
  render();
}

function render() {
  if (!root) return;
  root.innerHTML = '';
  const wrap = el('div', 'space-y-3');
  state.forEach((b, i) => wrap.appendChild(renderBlock(b, i)));
  root.appendChild(wrap);
  const toolbar = el('div', 'mt-3 flex flex-wrap gap-2');
  for (const t of ['p', 'h2', 'h3', 'img', 'list']) {
    const btn = el('button', 'rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:border-sea hover:text-sea-deep', `+ ${LABELS[t]}`);
    btn.type = 'button';
    btn.addEventListener('click', () => { state.push(makeBlock(t)); render(); });
    toolbar.appendChild(btn);
  }
  root.appendChild(toolbar);
}

/** Khởi tạo editor gắn vào container có id = rootId. */
export function initBlockEditor(rootId) {
  root = document.getElementById(rootId);
  state = [];
  if (root) render();
}

/** Nạp nội dung hiện có (khi sửa bài) vào editor. */
export function setBlocks(blocks) {
  state = (Array.isArray(blocks) ? blocks : []).map((b) => {
    const blk = makeBlock(b.type || 'p');
    if (b.type === 'img') { blk.src = b.src || ''; blk.alt = b.alt || ''; blk.preview = b.src || ''; }
    else if (b.type === 'list') { blk.items = Array.isArray(b.items) ? b.items : []; }
    else blk.text = b.text || '';
    return blk;
  });
  render();
}

/**
 * Thu thập nội dung từ editor.
 * Trả { content, images } — images = [{name, data(base64)}] của ảnh MỚI.
 * Ảnh cũ (src là /content/... hoặc http) giữ nguyên, không đưa vào images.
 */
export async function collectBlocks() {
  const content = [];
  const images = [];
  for (const b of state) {
    if (b.type === 'img') {
      if (b.file) {
        const img = await fileToImage(b.file);
        if (img) {
          b.src = img.name;
          images.push({ name: img.name, data: img.data });
        }
      }
      if (b.src) content.push({ type: 'img', src: b.src, alt: b.alt || '' });
    } else if (b.type === 'list') {
      const items = (b.items || []).filter((s) => s && s.trim());
      if (items.length) content.push({ type: 'list', items });
    } else {
      const text = (b.text || '').trim();
      if (text) content.push({ type: b.type, text });
    }
  }
  return { content, images };
}
