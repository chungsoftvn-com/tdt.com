import fixes from './image-quality.json' with { type: 'json' };
const branded = new Set(fixes.brand);
const blocked = new Set(fixes.blocked);
const canonical = (src = '') => String(src).replace(/^https?:\/\/(?:www\.)?todaytourist\.com/i, '');
const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const imageSource = (tag) => tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';

/** Known image repairs only. Original assets remain intact for rollback. */
export function fixContentImages(html = '') {
  let out = String(html).replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, (figure) => {
    if (blocked.has(canonical(imageSource(figure)))) return '';
    const src = imageSource(figure);
    if (!branded.has(src) && !branded.has(canonical(src))) return figure;
    return figure.replace(/<figure\b([^>]*)>/i, (_, attrs) => {
      const extra = /\bclass=["']([^"']*)["']/i.exec(attrs);
      const updated = extra ? attrs.replace(extra[0], 'class="'+escape(extra[1]+' content-photo-branded')+'"') : attrs+' class="content-photo-branded"';
      return '<figure'+updated+'>';
    });
  });
  return out.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = imageSource(tag);
    if (blocked.has(canonical(src))) return '';
    const replacement = fixes.replacements[src] || fixes.replacements[canonical(src)];
    let next = tag;
    if (replacement) {
      next = next.replace(/\bsrc=["'][^"']*["']/i, 'src="'+escape(replacement.src)+'"');
      next = /\balt=/.test(next) ? next.replace(/\balt=["'][^"']*["']/i, 'alt="'+escape(replacement.alt)+'"') : next.replace(/\s*\/?\s*>$/, ' alt="'+escape(replacement.alt)+'">');
    }
    // Intrinsic sizing prevents small/portrait photographs being stretched blurry.
    next = next.replace(/\s(?:width|height|style)=["'][^"']*["']/gi, '');
    return next.replace(/\s*\/?\s*>$/, ' style="display:block;width:auto;max-width:100%;height:auto;margin-inline:auto">');
  });
}
