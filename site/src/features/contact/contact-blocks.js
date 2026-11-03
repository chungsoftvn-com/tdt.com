import sanitizeHtml from 'sanitize-html';

export const plainText = (value = '') => sanitizeHtml(String(value), {
  allowedTags: [], allowedAttributes: {},
}).replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();

/** Remove only legacy contact fields; preserve itinerary, FAQs and related links. */
export function withoutLegacyTourContact(blocks = []) {
  return blocks.filter((block, index) => {
    if (block?.type === 'html') {
      const html = block.html || '';
      // Remove an isolated HTML contact card only when every leaf is a known field.
      const leaves = [...html.matchAll(/<(p|h[2-4]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => ({ type: m[1] === 'h4' ? 'h3' : m[1] === 'li' ? 'p' : m[1], text: m[2] }));
      const remainder = html.replace(/<(p|h[2-4]|li)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
      return !leaves.length || /<(?:img|table|iframe)\b/i.test(html) || Boolean(plainText(remainder)) || withoutLegacyTourContact(leaves).length > 0;
    }
    if (!block || !['p', 'h2', 'h3'].includes(block.type)) return true;
    const raw = block.text || '';
    const text = plainText(raw);
    const normalized = text.replace(/^[^\p{L}\p{N}]+/u, '');
    if (['h2', 'h3'].includes(block.type)) {
      return !/^(?:thông tin liên hệ(?: đặt tour)?|liên hệ(?: tư vấn(?: riêng| tour .+)?| đặt tour| today\s?tourist)?)(?:\s+và đặt tour)?\s*[:.!]?$/iu.test(normalized);
    }
    // A phone in an answer is substantive article content, not a legacy form.
    if (block.type === 'p' && plainText(blocks[index - 1]?.text || '').endsWith('?') && !/^(?:công ty|địa chỉ|(?:số\s+)?80\s+đặng nguyên)/iu.test(normalized)) return true;
    // These are company contact fields, never the airport ticket specialist's card.
    if (/(?:0902[\s.\-]*898[\s.\-]*726|0913[\s.\-]*78[\s.\-]*76[\s.\-]*47|0913[\s.\-]*787[\s.\-]*647)/.test(text)
      && /^(?:mr\.?\s*anh văn|hotline|điện thoại|zalo|gọi tư vấn|tư vấn\s*:|liên hệ mr\.?\s*anh văn|nhận báo giá đoàn|nhắn zalo)/iu.test(normalized)) return false;
    if (/^(?:công ty\s+(?:tnhh\s+)?du lịch\s+(?:ngày hôm nay|today\s?tourist)|(?:địa chỉ\s*:\s*)?(?:số\s+)?80\s+đặng nguyên|today\s?tourist\s*[–—-]\s*cùng bạn đi khắp năm châu)/iu.test(normalized)) return false;
    if (/^(?:email\s*:\s*)?lesangtravel@gmail\.com[\s.!]*$/i.test(normalized)) return false;
    if (/^(?:website\s*:\s*)?(?:https?:\/\/)?(?:www\.)?todaytourist\.com\/?[\s.!]*$/i.test(normalized)) return false;
    if (/^(?:zalo|nhắn zalo|trao đổi với mr\.?\s*anh văn qua zalo)/iu.test(normalized) && /href=["']https:\/\/zalo\.me\/0902898726["']/i.test(raw)) return false;
    return true;
  });
}
