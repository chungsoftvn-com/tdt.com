import sanitizeHtml from 'sanitize-html';
const text = (s = '') => sanitizeHtml(String(s), { allowedTags: [], allowedAttributes: {} }).trim();
/** Stable, unique anchors generated from the same blocks that are rendered. */
export function articleContents(source = []) {
  const toc = [];
  const used = new Set();
  const heading = (label, level, preferred) => {
    let id = preferred && /^[a-zA-Z][\w:.-]*$/.test(preferred) && !used.has(preferred) ? preferred : `reading-section-${toc.length + 1}`;
    while (used.has(id)) id += '-section';
    used.add(id);
    toc.push({ id, label: text(label), level });
    return id;
  };
  const blocks = source.map(block => {
    if (!block) return block;
    if (['h2', 'h3'].includes(block.type)) return { ...block, id: heading(block.text || '', block.type) };
    if (block.type === 'html') return { ...block, html: String(block.html || '').replace(/<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_, tag, attrs, body) => {
      const existing = attrs.match(/\bid\s*=\s*["']([^"']*)["']/i)?.[1];
      const id = heading(body, tag, existing);
      return `<${tag}${attrs.replace(/\s+id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')} id="${id}">${body}</${tag}>`;
    }) };
    return block;
  });
  return { blocks, toc };
}
const tokens = (s = '') => new Set(text(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !['tour','ngay','dem','dong','nai','thanh','pho','lich','trinh','khach','tu','va','cho','theo'].includes(w)));
export function relatedItems(current, list = [], limit = 3) {
  const own = tokens(current.title || current.name);
  const score = item => {
    let value = 0;
    if (current.category && item.category === current.category) value += 8;
    if (current.regionName && item.regionName === current.regionName) value += 8;
    for (const word of tokens(item.title || item.name)) if (own.has(word)) value += 2;
    return value;
  };
  return list.filter(item => item.slug !== current.slug && !item.hidden).map((item, index) => ({ item, index, score: score(item) })).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(x => x.item);
}
