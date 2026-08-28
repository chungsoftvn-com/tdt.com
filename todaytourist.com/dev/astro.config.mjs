import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Astro writes the site into `.astro-dist/` (a staging folder).
// The real publish folder is `../dist` — `scripts/build.mjs` assembles it
// from this staging output (so the publish repo's `.git` is never touched).
export default defineConfig({
  site: 'https://todaytourist.com',
  outDir: './.astro-dist',
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
