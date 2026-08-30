globalThis.process ??= {}; globalThis.process.env ??= {};
import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_PhUiO5sI.mjs';
import { manifest } from './manifest_D4gfiutc.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/404.astro.mjs');
const _page1 = () => import('./pages/admin/news.astro.mjs');
const _page2 = () => import('./pages/admin/pages.astro.mjs');
const _page3 = () => import('./pages/admin/tours.astro.mjs');
const _page4 = () => import('./pages/admin.astro.mjs');
const _page5 = () => import('./pages/_lang_/home/generated.astro.mjs');
const _page6 = () => import('./pages/_lang_/tin-tuc/_slug_.astro.mjs');
const _page7 = () => import('./pages/_lang_/tin-tuc.astro.mjs');
const _page8 = () => import('./pages/_lang_/tour/_slug_.astro.mjs');
const _page9 = () => import('./pages/_lang_/_page_.astro.mjs');
const _page10 = () => import('./pages/_lang_.astro.mjs');
const _page11 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["src/pages/404.astro", _page0],
    ["src/pages/admin/news.astro", _page1],
    ["src/pages/admin/pages.astro", _page2],
    ["src/pages/admin/tours.astro", _page3],
    ["src/pages/admin/index.astro", _page4],
    ["src/pages/[lang]/home/generated.astro", _page5],
    ["src/pages/[lang]/tin-tuc/[slug].astro", _page6],
    ["src/pages/[lang]/tin-tuc.astro", _page7],
    ["src/pages/[lang]/tour/[slug].astro", _page8],
    ["src/pages/[lang]/[page].astro", _page9],
    ["src/pages/[lang]/index.astro", _page10],
    ["src/pages/index.astro", _page11]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = undefined;
const _exports = createExports(_manifest);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
