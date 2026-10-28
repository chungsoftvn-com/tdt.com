/** This prepares a draft only: the customer explicitly sends it in their email app. */
export function buildReviewEmail(data) {
  const author = String(data.author || '').trim();
  const rating = Number(data.rating);
  const text = String(data.body || '').trim();
  if (author.length < 2 || author.length > 80 || text.length < 10 || text.length > 1000
    || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Invalid review');
  }
  const body = [data.tour, data.url, '', `Tên hiển thị: ${author}`, `Số sao: ${rating}/5`,
    `Ngày khởi hành: ${data.tripDate}`, '', text, '', data.consent].join('\n');
  return { body, href: `mailto:${data.email}?subject=${encodeURIComponent(`${data.subject}: ${data.tour}`)}&body=${encodeURIComponent(body)}` };
}
