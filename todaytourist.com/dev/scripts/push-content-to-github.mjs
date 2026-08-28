#!/usr/bin/env node
/**
 * Đồng bộ content VI hiện có (tours, news, ảnh) lên GitHub repo content
 * của site — để admin PROD đọc được danh sách (admin đọc qua Worker -> GitHub).
 *
 * Worker đọc/ghi tại: <repo>/<path_prefix>/content/vi/... và .../public/content/vi/images/
 * (path_prefix lấy từ sites.config.json của site todaytourist).
 *
 * Cách chạy (cần GITHUB_TOKEN trong worker/.dev.vars):
 *   node scripts/push-content-to-github.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { readSites, loadDotVars } from '../worker/config-util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...loadDotVars(path.join(ROOT, 'worker', '.dev.vars')) };
const site = readSites(path.join(ROOT, 'worker', 'sites.config.json')).find((s) => s.id === 'todaytourist');
if (!site) {
  console.error('Không tìm thấy site todaytourist.');
  process.exit(1);
}
const TOKEN = env.GITHUB_TOKEN;
if (!TOKEN || TOKEN.startsWith('YOUR_')) {
  console.error('Thiếu GITHUB_TOKEN trong worker/.dev.vars.');
  process.exit(1);
}

const api = `https://api.github.com/repos/${site.github.owner}/${site.github.repo}`;
const basePath = (site.github.path_prefix || '').replace(/^\/+|\/+$/g, '');
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'site-admin-worker',
};

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function collectFiles() {
  const files = [];
  const addDir = (dir, prefix) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) addDir(abs, rel);
      else files.push({ abs, rel });
    }
  };
  addDir(path.join(ROOT, 'content', 'vi'), 'content/vi');
  addDir(path.join(ROOT, 'public', 'content', 'vi', 'images'), 'public/content/vi/images');
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
  const files = collectFiles();
  console.log(`[push] ${files.length} file (content/vi + public/content/vi/images) -> ${site.github.owner}/${site.github.repo}${basePath ? '/' + basePath : ''}`);

  // 1) HEAD commit sha
  const head = await gh(`${api}/git/ref/heads/main`);
  const commitSha = head.object.sha;
  const commitObj = await gh(`${api}/git/commits/${commitSha}`);
  const baseTreeSha = commitObj.tree.sha;

  // 2) Blobs
  const tree = [];
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    const isText = f.rel.endsWith('.json');
    const body = isText
      ? JSON.stringify({ content: buf.toString('utf-8') })
      : JSON.stringify({ content: bytesToBase64(new Uint8Array(buf)), encoding: 'base64' });
    const blob = await gh(`${api}/git/blobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    tree.push({ path: basePath ? `${basePath}/${f.rel}` : f.rel, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 3) Tree + commit + ref
  const newTree = await gh(`${api}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  const commit = await gh(`${api}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `content: sync vi content from source (${files.length} files)`, tree: newTree.sha, parents: [commitSha] }),
  });
  await gh(`${api}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  console.log(`[push] OK commit ${commit.sha.slice(0, 8)} -> ${site.github.repo}@main`);
}

main().catch((e) => {
  console.error('[push] LỖI:', e.message);
  process.exit(1);
});
