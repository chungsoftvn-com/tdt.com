#!/usr/bin/env node
/**
 * copy-extra-assets.mjs — copy các thư mục KHÔNG do Astro sinh ra vào output.
 *
 * CI (.github/workflows/build.yml → step "Copy extra assets") vẫn làm việc này,
 * nhưng khi build ở máy thì thiếu → ảnh nội dung (`/content/vi/images/...`) bị 404
 * và admin (Decap) không thấy config. Script này để build local khớp với CI.
 *
 *   ../content  -> .astro-dist/content   (ảnh tour, tin tức, ảnh Facebook…)
 *   ../layouts  -> .astro-dist/layouts
 *   admin/config.json -> .astro-dist/admin/config.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const DIST = path.join(ROOT, '.astro-dist');

if (!fs.existsSync(DIST)) {
  console.error('[assets] Chưa có .astro-dist — hãy chạy astro build trước.');
  process.exit(1);
}

const pairs = [
  [path.join(REPO, 'content'), path.join(DIST, 'content')],
  [path.join(REPO, 'layouts'), path.join(DIST, 'layouts')],
];

for (const [src, dst] of pairs) {
  if (!fs.existsSync(src)) continue;
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true, force: true });
  console.log(`[assets] ${path.relative(ROOT, dst)} <- ${path.relative(ROOT, src)}`);
}

const adminCfg = path.join(ROOT, 'admin', 'config.json');
if (fs.existsSync(adminCfg)) {
  const dst = path.join(DIST, 'admin', 'config.json');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(adminCfg, dst);
  console.log('[assets] .astro-dist/admin/config.json');
}
