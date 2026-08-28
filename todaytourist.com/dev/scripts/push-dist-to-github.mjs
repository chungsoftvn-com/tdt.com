#!/usr/bin/env node
/**
 * Đẩy toàn bộ dist/ (GitHub Pages repo hoàn chỉnh) lên repo Pages của site.
 * - Ghi đè/THÊM các file site ở GỐC repo.
 * - XOÁ các file root cũ không còn trong dist (vd _astro bundle cũ).
 * - GIỮ NGUYÊN subtree <path_prefix>/ (thư mục content của worker) — base_tree giữ
 *   các path không được liệt kê trong tree mới.
 *
 * Cách chạy (cần GITHUB_TOKEN trong worker/.dev.vars):
 *   node scripts/push-dist-to-github.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSites, loadDotVars } from '../worker/config-util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(ROOT, '..', 'dist'); // todaytourist.com/dist
const env = { ...loadDotVars(path.join(ROOT, 'worker', '.dev.vars')) };
const site = readSites(path.join(ROOT, 'worker', 'sites.config.json')).find((s) => s.id === 'todaytourist');
if (!site) { console.error('Không tìm thấy site todaytourist.'); process.exit(1); }

const TOKEN = env.GITHUB_TOKEN;
if (!TOKEN || TOKEN.startsWith('YOUR_')) { console.error('Thiếu GITHUB_TOKEN trong worker/.dev.vars.'); process.exit(1); }

const api = `https://api.github.com/repos/${site.github.owner}/${site.github.repo}`;
const prefix = (site.github.path_prefix || '').replace(/^\/+|\/+$/g, ''); // vd todaytourist.com/dev
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'site-admin-worker',
};

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function collectDist() {
  const files = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) walk(abs, r);
      else files.push({ abs, rel: r });
    }
  };
  walk(DIST, '');
  return files;
}

async function gh(url, opts) {
  const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts?.headers || {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  if (!fs.existsSync(DIST)) { console.error('Không thấy dist/', DIST); process.exit(1); }
  const files = collectDist();
  const distSet = new Set(files.map((f) => f.rel));
  console.log(`[push-dist] ${files.length} file dist -> ${site.github.repo} (giữ nguyên '${prefix}/')`);

  // 1) HEAD + recursive tree
  const head = await gh(`${api}/git/ref/heads/main`);
  const commitObj = await gh(`${api}/git/commits/${head.object.sha}`);
  const tree = await gh(`${api}/git/trees/${commitObj.tree.sha}?recursive=1`);

  // 2) Tree entries mới: xoá file root cũ không còn trong dist (giữ nguyên subtree prefix)
  const treeEntries = [];
  for (const ent of tree.tree || []) {
    if (ent.type !== 'blob') continue;
    const p = ent.path;
    if (p.startsWith(prefix + '/') || p === prefix) continue; // GIỮ content của worker
    if (!distSet.has(p)) treeEntries.push({ path: p, mode: '100644', type: 'blob', sha: null }); // xoá
  }

  // 3) Thêm file dist
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    const isText = /\.(json|html|css|js|txt|md|svg|webmanifest|xml|yml|yaml|toml)$/.test(f.rel) || /^\./.test(path.basename(f.rel));
    const body = isText
      ? JSON.stringify({ content: buf.toString('utf-8') })
      : JSON.stringify({ content: bytesToBase64(new Uint8Array(buf)), encoding: 'base64' });
    const blob = await gh(`${api}/git/blobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    treeEntries.push({ path: f.rel, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 4) Tree + commit + ref
  const newTree = await gh(`${api}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: commitObj.tree.sha, tree: treeEntries }),
  });
  const commit = await gh(`${api}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `site: deploy dist (${files.length} files)`, tree: newTree.sha, parents: [head.object.sha] }),
  });
  await gh(`${api}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  console.log(`[push-dist] OK commit ${commit.sha.slice(0, 8)} -> ${site.github.repo}@main`);
}

main().catch((e) => { console.error('[push-dist] LỖI:', e.message); process.exit(1); });
