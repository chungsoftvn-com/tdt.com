globalThis.process ??= {}; globalThis.process.env ??= {};
import './chunks/astro-designed-error-pages_Dvv6Iznj.mjs';
import './chunks/astro/server_ShlDONhy.mjs';
import { k as sequence } from './chunks/render-context_DAL2CSe9.mjs';

const onRequest$1 = (context, next) => {
  if (context.isPrerendered) {
    context.locals.runtime ??= {
      env: process.env
    };
  }
  return next();
};

const onRequest = sequence(
	onRequest$1,
	
	
);

export { onRequest };
