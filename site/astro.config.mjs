import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from "@astrojs/cloudflare";

// Astro writes the site into `.astro-dist/`.
// GitHub Pages CI (../.github/workflows/build.yml) uploads `.astro-dist`
// sau khi copy `../content` + `../layouts` vào output.
export default defineConfig({
  site: 'https://todaytourist.com',
  outDir: './.astro-dist',

  build: {
    format: 'directory',
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare()
});