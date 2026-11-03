import sanitizeHtml from 'sanitize-html';

export const plainText = (value = '') => sanitizeHtml(String(value), {
  allowedTags: [], allowedAttributes: {},
}).replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();

/** Remove only legacy contact fields; preserve itinerary, FAQs and related links. */
export function withoutLegacyTourContact(blocks = []) {
  return blocks.filter((block) => {
    if (!block || !['p', 'h2', 'h3'].includes(block.type)) return true;
    const raw = block.text || '';
    const text = plainText(raw);
    const normalized = text.replace(/^[^\p{L}\p{N}]+/u, '');
    if (['h2', 'h3'].includes(block.type)) {
      return !/^(?:thông tin liên hệ(?: đặt tour)?|liên hệ(?: tư vấn(?: riêng| tour .+)?| đặt tour| today\s?tourist)?)(?:\s+và đặt tour)?\s*[:.!]?$/iu.test(normalized);
    }
    // These are company contact fields, never the airport ticket specialist's card.
    if (/(?:0902[\s.\-]*898[\s.\-]*726|0913[\s.\-]*78[\s.\-]*76[\s.\-]*47|0913[\s.\-]*787[\s.\-]*647)/.test(text)) return false;
    if (/^(?:công ty\s+(?:tnhh\s+)?du lịch\s+(?:ngày hôm nay|today\s?tourist)|(?:địa chỉ\s*:\s*)?(?:số\s+)?80\s+đặng nguyên|today\s?tourist\s*[–—-]\s*cùng bạn đi khắp năm châu)/iu.test(normalized)) return false;
    if (/^(?:email\s*:\s*)?lesangtravel@gmail\.com[\s.!]*$/i.test(normalized)) return false;
    if (/^(?:website\s*:\s*)?(?:https?:\/\/)?(?:www\.)?todaytourist\.com\/?[\s.!]*$/i.test(normalized)) return false;
    if (/href=["']https:\/\/zalo\.me\/0902898726["']/i.test(raw)) return false;
    return true;
  });
}
