import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const siteDir = fileURLToPath(new URL('../', import.meta.url));
let lastmod = {};
try {
  const log = execSync('git log --format=%cI --name-only -- ../content/vi', {
    cwd: siteDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let date = null;
  for (const raw of log.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(line)) {
      date = line;
    } else if (date && /^content\/vi\/.+\.json$/.test(line) && !line.split('/').includes('images')) {
      if (!Object.hasOwn(lastmod, line)) lastmod[line] = date;
    }
  }
} catch (error) {
  console.warn('Không đọc được git log, dùng lastmod rỗng:', error.message);
  lastmod = {};
}
const dataDir = new URL('../src/data/', import.meta.url);
mkdirSync(dataDir, { recursive: true });
writeFileSync(new URL('lastmod.json', dataDir), JSON.stringify(lastmod, null, 2) + '\n');
console.log('Đã ghi lastmod cho ' + Object.keys(lastmod).length + ' file.');
