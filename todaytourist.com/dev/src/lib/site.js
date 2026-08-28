import fs from 'node:fs';
import path from 'node:path';

/**
 * Site-level configuration read from `admin/config.json` (the file the
 * future admin panel edits). Currently it drives which layout is active
 * at build time.
 */
export function getSiteConfig() {
  const p = path.join(process.cwd(), 'admin', 'config.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { layout: 'layout1_xugawear.vercel.app', defaultLang: 'vi' };
  }
}

/** Name of the active layout folder under `layouts/`. */
export function getActiveLayout() {
  return getSiteConfig().layout || 'layout1_xugawear.vercel.app';
}
