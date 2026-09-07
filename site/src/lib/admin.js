/**
 * Cấu hình + helper cho Admin UI.
 * Worker dùng chung (đa site): <site-id>/api/...
 * - Dev:  Worker local (npm run dev trong worker/) tại localhost:8787
 * - Prod: Worker trên *.workers.dev (điền subdomain sau khi `wrangler deploy`)
 */
export const ADMIN_SITE_ID = 'todaytourist';

export const ADMIN_WORKER_ORIGIN = import.meta.env.DEV
  ? 'http://localhost:8787'
  : 'https://site-admin-worker.nvtuan1689.workers.dev'; // Worker DÙNG CHUNG cho mọi site

/** Repo GitHub mà Worker commit nội dung bài viết (khớp github.owner/repo trong worker/sites.config.json). */
export const ADMIN_GITHUB_REPO = 'chungsoftvn-com/tdt.com';

export function adminApi(path) {
  return `${ADMIN_WORKER_ORIGIN}/${ADMIN_SITE_ID}/api${path}`;
}

/**
 * Gọi API worker với credentials (cookie httpOnly được gửi tự động).
 * Trả { status, data }.
 */
export async function api(method, path, body) {
  const res = await fetch(adminApi(path), {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* không phải JSON */
  }
  return { status: res.status, data };
}

/**
 * Vô hiệu hoá nút + hiện spinner "loading" ngay cạnh khi đang xử lý
 * (tránh user bấm nhiều lần). Gọi setBusy(btn, true, '...') rồi setBusy(btn, false) khi xong.
 */
export function setBusy(btn, busy, loadingText = 'Đang xử lý...') {
  if (!btn) return;
  if (busy) {
    if (!btn.dataset._orig) btn.dataset._orig = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('cursor-wait', 'opacity-70');
    btn.innerHTML = `<span class="inline-flex items-center justify-center gap-2"><span class="spinner"></span>${loadingText}</span>`;
  } else {
    btn.disabled = false;
    btn.classList.remove('cursor-wait', 'opacity-70');
    if (btn.dataset._orig) btn.innerHTML = btn.dataset._orig;
  }
}

/** Chuyển file ảnh -> { name, data } base64 (nén WebP bằng canvas nếu có). */
export async function fileToImage(file) {
  if (!file) return undefined;
  let blob = file;
  let name = file.name || 'image.webp';
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const webp = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (webp) {
      blob = webp;
      name = name.replace(/\.[^.]+$/, '') + '.webp';
    }
    bmp.close?.();
  } catch {
    /* giữ nguyên file nếu không nén được */
  }
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return { name, data: btoa(binary) };
}
