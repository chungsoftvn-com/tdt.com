const plain = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
export const durationDays = (value = '') => Number(plain(value).match(/(\d+)\s*(?:ngay|n(?=\d|\s|$))/)?.[1]) || null;
export const priceVnd = (value = '') => {
  const match = String(value).match(/(\d[\d.,\s]*)\s*(?:đ|vnd)/i);
  return match ? Number(match[1].replace(/\D/g, '')) || null : null;
};
export function matchesDays(days, group) {
  if (!group) return true;
  if (!days) return false;
  return group === '1' ? days === 1 : group === '2-3' ? days >= 2 && days <= 3 : group === '4-5' ? days >= 4 && days <= 5 : group === '6+' ? days >= 6 : false;
}
export function comparePrices(a, b, direction = 'asc') {
  const x = Number(a) || null, y = Number(b) || null;
  if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
  return direction === 'desc' ? y - x : x - y;
}
