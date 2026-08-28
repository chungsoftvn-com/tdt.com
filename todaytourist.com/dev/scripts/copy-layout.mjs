import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

export function cp(src, dst) {
  fs.cpSync(src, dst, { recursive: true, force: true });
}

/**
 * Copy the active layout's `pages/` and `components/` into Astro's `src/`.
 *
 * `layouts/<name>/pages/*`      -> `src/pages/*`
 * `layouts/<name>/components/*` -> `src/components/*`
 *
 * Because only one layout is active per build, clearing both folders first
 * guarantees the output never mixes templates from different layouts.
 */
export function copyLayout(layout) {
  const layoutDir = path.join(ROOT, 'layouts', layout);
  if (!fs.existsSync(layoutDir)) {
    throw new Error(
      `[layout] Layout not found: "${layout}" (expected at ${layoutDir})`,
    );
  }

  const dstPages = path.join(ROOT, 'src', 'pages');
  const dstComponents = path.join(ROOT, 'src', 'components');

  rmrf(dstPages);
  rmrf(dstComponents);
  fs.mkdirSync(dstPages, { recursive: true });
  fs.mkdirSync(dstComponents, { recursive: true });

  const srcPages = path.join(layoutDir, 'pages');
  const srcComponents = path.join(layoutDir, 'components');

  if (fs.existsSync(srcPages)) cp(srcPages, dstPages);
  if (fs.existsSync(srcComponents)) cp(srcComponents, dstComponents);

  console.log(`[layout] active layout: ${layout}`);
  console.log(`[layout] pages copied:      ${path.relative(ROOT, dstPages)}`);
  console.log(`[layout] components copied: ${path.relative(ROOT, dstComponents)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const layout = process.argv[2] ?? 'layout1_xugawear.vercel.app';
  copyLayout(layout);
}
