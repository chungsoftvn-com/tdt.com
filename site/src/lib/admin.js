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
 * Trả { status, data }. Lỗi mạng/timeout trả status 0 (KHÔNG ném) để UI hiển
 * thị thông báo thay vì "đứng im" — hay gặp khi payload có ảnh nặng.
 */
export async function api(method, path, body) {
  try {
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
      /* không phải JSON (ví dụ trang lỗi 502/524 của Cloudflare) */
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: null, networkError: err instanceof Error ? err.message : String(err) };
  }
}

/** Thông báo lỗi đọc được cho admin (dùng chung mọi trang admin). */
export function describeSaveError(r) {
  const data = r && r.data;
  if (!r || r.status === 0) {
    return 'Không kết nối được tới máy chủ (mạng chậm hoặc bị ngắt khi gửi ảnh). Nội dung chưa được lưu — vui lòng thử lại.';
  }
  if (r.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng mở /admin đăng nhập lại rồi bấm Lưu lại (nội dung chưa được lưu).';
  }
  if (data && data.error === 'forbidden_origin') {
    return 'Origin không được phép (kiểm tra ALLOWED_ORIGIN của site).';
  }
  if (data && typeof data.message === 'string' && data.message) {
    return `Lưu thất bại: ${data.message}`;
  }
  if (data && typeof data.detail === 'string' && data.detail) {
    return `Lưu thất bại (lỗi máy chủ): ${data.detail}`;
  }
  if (data && typeof data.error === 'string' && data.error) {
    return `Lưu thất bại (${data.error}).`;
  }
  return `Lưu thất bại (HTTP ${r.status}).`;
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

/** Hạn mỗi ảnh phía server — phải KHỚP `MAX_IMAGE_BYTES` trong dev/worker/src/image.ts. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Đích nhắm sau khi nén: nhỏ hơn hạn server để gửi được nhiều ảnh trong 1 lần lưu. */
const TARGET_IMAGE_BYTES = 1200 * 1024;
/** Các mức thử khi nén: giảm dần cạnh dài rồi giảm chất lượng cho tới khi đạt đích. */
const EDGE_STEPS = [1600, 1280, 1024, 800, 640];
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5];
/** Định dạng gửi nguyên file gốc cũng hiển thị được trên web. */
const RAW_OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function extForBlob(blob, fallbackName) {
  const BY_MIME = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/avif': 'avif',
  };
  if (BY_MIME[blob.type]) return BY_MIME[blob.type];
  const m = String(fallbackName || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : 'webp';
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000; // từng khối để tránh tràn stack khi ảnh lớn
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Nén 1 ảnh về WebP (hoặc JPEG nếu trình duyệt không encode được WebP),
 * hạ dần kích thước/chất lượng cho tới khi ≤ TARGET_IMAGE_BYTES.
 * Trả blob nhỏ nhất đạt được, hoặc null nếu không giải mã được file.
 */
async function compressImage(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return null; // sai định dạng / trình duyệt không hỗ trợ (HEIC, TIFF, RAW...)
  }
  try {
    let best = null;
    for (const edge of EDGE_STEPS) {
      const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      for (const quality of QUALITY_STEPS) {
        let blob = await canvasToBlob(canvas, 'image/webp', quality);
        // Trình duyệt không encode được WebP -> toBlob trả PNG (nặng) -> chuyển sang JPEG.
        if (!blob || blob.type !== 'image/webp') {
          const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
          if (jpeg && (!blob || jpeg.size < blob.size)) blob = jpeg;
        }
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= TARGET_IMAGE_BYTES) return best;
      }
    }
    return best;
  } finally {
    bmp.close?.();
  }
}

/**
 * Chuyển file ảnh -> { name, data } base64.
 *
 * Ảnh được nén WebP (≤ ~1.2MB) trước khi gửi. Nếu trình duyệt không xử lý được
 * file (HEIC/TIFF từ điện thoại, file lỗi) thì chỉ gửi nguyên file khi đó là
 * định dạng web an toàn và vẫn dưới hạn server; ngược lại NÉM lỗi có thông báo
 * tiếng Việt để UI hiển thị (trước đây gửi ầm thầm → server trả 400 → admin chỉ
 * thấy "Lưu thất bại.").
 */
export async function fileToImage(file) {
  if (!file) return undefined;
  const originalName = file.name || 'image.webp';
  const stem = (originalName.replace(/\.[^.]+$/, '') || 'image').toLowerCase().slice(0, 80);

  const compressed = await compressImage(file);
  let blob = file;
  if (compressed && compressed.size < file.size) {
    blob = compressed;
  } else if (!RAW_OK_TYPES.includes(file.type)) {
    throw new Error(
      `Ảnh "${originalName}" không xử lý được trên trình duyệt này. ` +
        'Vui lòng chọn ảnh JPG/PNG/WebP (ảnh HEIC từ iPhone nên được lưu sang JPG trước khi tải lên).',
    );
  }

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Ảnh "${originalName}" quá lớn (${mb(blob.size)} — tối đa ${mb(MAX_IMAGE_BYTES)}). ` +
        'Vui lòng chọn ảnh nhỏ hơn.',
    );
  }
  return { name: `${stem}.${extForBlob(blob, originalName)}`, data: await blobToBase64(blob) };
}
