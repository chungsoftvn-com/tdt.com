import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyLayout, rmrf, cp } from './copy-layout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, '..', 'dist'); // publish repo: todaytourist.com/dist
const ASTRO_OUT = path.join(ROOT, '.astro-dist');

/** Files/folders that belong to the dist *repo* and must survive rebuilds.
 *  (.github được tái tạo mỗi build bởi writeRepoFiles() nên KHÔNG giữ lại —
 *  tránh workflow cũ lưu sót.) */
const DIST_KEEP = new Set([
  '.git',
  '.gitignore',
  '.nojekyll',
  'CNAME',
  'README.md',
  'LICENSE',
]);

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' });
}

function ensureEnglishContent() {
  console.log('\n== 1/4 Translate vi -> en (Argos Translate) ==');
  try {
    run('python scripts/translate.py');
  } catch (err) {
    // Hard fallback: if Python/Argos is unavailable, reuse existing `en/`
    // or copy `vi/` as a stopgap so the site still builds everywhere.
    console.warn('[build] translate.py failed — falling back to copying vi -> en');
    rmrf(path.join(ROOT, 'content', 'en'));
    cp(path.join(ROOT, 'content', 'vi'), path.join(ROOT, 'content', 'en'));
  }
}

function astroBuild() {
  console.log('\n== 2/4 Astro build ==');
  rmrf(ASTRO_OUT);
  run('npm run build:astro');
}

/** Nội dung dist/ = GitHub Pages repo hoàn chỉnh (commit dist/* sang repo khác là xong).
 *  dist/ chứa: site đã build (root) + TOÀN BỘ SOURCE (todaytourist.com/dev/) để CI tự build.
 */
const PAGES_REPO_README = `# todaytourist.com — GitHub Pages

Static site published to GitHub Pages.

- Build thủ công: \`cd todaytourist.com/dev && npm run build\` rồi commit \`dist/*\`
- Hoặc admin đăng bài → worker commit JSON vào \`todaytourist.com/dev/content/vi\`
- Workflow \`.github/workflows/build.yml\` khi push \`main\`:
    dịch vi→en (chỉ file thay đổi) + Astro build → deploy lên Pages
`;

const PAGES_REPO_WORKFLOW = `name: Build & Deploy (translate vi→en + Astro)

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: todaytourist.com/dev/package-lock.json
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        working-directory: todaytourist.com/dev
        run: npm ci
      - name: Setup Argos Translate (best-effort)
        working-directory: todaytourist.com/dev
        run: python scripts/setup-argos.py || echo "Argos unavailable - fallback"
      - name: Build site (copyLayout + translate chọn lọc + Astro)
        working-directory: todaytourist.com/dev
        run: |
          node scripts/copy-layout.mjs
          python scripts/translate.py
          npm run build:astro
          mkdir -p .astro-dist/admin
          cp admin/config.json .astro-dist/admin/config.json
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: todaytourist.com/dev/.astro-dist
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
`;

/** Ghi các file cần thiết để dist/ thành 1 GitHub Pages repo hoàn chỉnh. */
function writeRepoFiles() {
  const mk = (rel) => path.join(DIST, rel);
  fs.mkdirSync(path.join(DIST, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(DIST, '.github', 'workflows', 'build.yml'), PAGES_REPO_WORKFLOW, 'utf8');
  fs.writeFileSync(mk('CNAME'), 'todaytourist.com\n', 'utf8');
  fs.writeFileSync(mk('.nojekyll'), '', 'utf8');
  fs.writeFileSync(mk('README.md'), PAGES_REPO_README, 'utf8');
  fs.writeFileSync(mk('.gitignore'), '.DS_Store\nThumbs.db\n', 'utf8');
  const lic = path.join(ROOT, 'LICENSE');
  if (fs.existsSync(lic)) fs.copyFileSync(lic, mk('LICENSE'));
  console.log('[dist] repo files: .github/workflows/build.yml, CNAME, .nojekyll, README, .gitignore');
}

/** Các mục source được copy vào dist/todaytourist.com/dev/ (bỏ worker để tránh secret,
 *  bỏ node_modules/.astro/downloads/old/...). CI dựa vào đây để build lại site. */
const SOURCE_ALLOW = new Set([
  'package.json',
  'package-lock.json',
  'astro.config.mjs',
  'tsconfig.json',
  '.gitignore',
  'LICENSE',
  'admin',
  'content',
  'layouts',
  'public',
  'scripts',
  'src',
]);

/** Copy nguồn + content JSON vào dist/todaytourist.com/dev/ để repo Pages tự build được. */
function copySourceIntoDist() {
  const srcDev = path.join(DIST, prefixDev());
  fs.mkdirSync(srcDev, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!SOURCE_ALLOW.has(entry.name)) continue;
    const from = path.join(ROOT, entry.name);
    const to = path.join(srcDev, entry.name);
    if (entry.isDirectory()) cp(from, to);
    else if (fs.existsSync(from)) fs.copyFileSync(from, to);
    n++;
  }
  console.log(`[dist] source + content JSON copied -> ${path.relative(DIST, srcDev)} (${n} items)`);
}

/** Thư mục source trong repo Pages: <dist>/todaytourist.com/dev (khớp path_prefix worker). */
function prefixDev() {
  return path.join('todaytourist.com', 'dev');
}

function assembleDist() {
  console.log('\n== 3/4 Assemble dist ==');
  fs.mkdirSync(DIST, { recursive: true }); // CI: fresh checkout chưa có dist/
  // Wipe everything that is not part of the dist repo (keep .git, .github, README...).
  for (const entry of fs.readdirSync(DIST)) {
    if (!DIST_KEEP.has(entry)) rmrf(path.join(DIST, entry));
  }
  // Copy the freshly built site.
  cp(ASTRO_OUT, DIST);

  // The admin config that describes the active layout (used by /admin later).
  const adminOut = path.join(DIST, 'admin');
  fs.mkdirSync(adminOut, { recursive: true });
  cp(path.join(ROOT, 'admin', 'config.json'), path.join(adminOut, 'config.json'));

  // Toàn bộ source + content JSON vào dist/todaytourist.com/dev (để CI build được).
  copySourceIntoDist();

  writeRepoFiles();
  console.log(`[dist] site written to ${path.relative(ROOT, DIST)}`);
}

function verify() {
  console.log('\n== 4/4 Verify ==');
  const required = [
    'index.html',
    'vi/index.html',
    'en/index.html',
    'admin/index.html',
    'admin/config.json',
    'content/vi/images/logo.webp',
  ];
  let ok = true;
  for (const rel of required) {
    const p = path.join(DIST, rel);
    const exists = fs.existsSync(p);
    console.log(`  ${exists ? 'OK ' : 'MISS'}  ${rel}`);
    if (!exists) ok = false;
  }
  if (!ok) {
    console.error('[build] ERROR: required files missing in dist.');
    process.exit(1);
  }
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');
  if (!html.includes('TODAYTOURIST')) {
    console.error('[build] ERROR: dist/index.html does not look like our site.');
    process.exit(1);
  }
  console.log('[build] SUCCESS: static site ready in dist/.');
}

function main() {
  const config = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'admin', 'config.json'), 'utf-8'),
  );
  console.log(`[build] reading admin/config.json -> layout "${config.layout}"`);
  copyLayout(config.layout);

  ensureEnglishContent();
  astroBuild();
  assembleDist();
  verify();
}

main();
