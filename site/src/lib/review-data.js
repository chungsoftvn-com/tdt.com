export function reviewToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function validDate(value, today) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value && value <= today;
}

/** Only direct, verified customer reviews with publication consent qualify.
 * Google Maps/company ratings and testimonials never become tour ratings.
 * UI and JSON-LD deliberately share this exact filtered dataset.
 */
export function normalizeReviews(records, slug, today = reviewToday()) {
  if (!Array.isArray(records)) return [];
  const ids = new Set();
  return records.flatMap((r) => {
    if (!r || r.tourSlug !== slug || r.status !== 'published'
      || r.source !== 'direct' || r.verified !== true || r.consent !== true
      || typeof r.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(r.id) || ids.has(r.id)
      || !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5
      || typeof r.author !== 'string' || r.author.trim().length < 2 || r.author.trim().length > 80
      || typeof r.body !== 'string' || r.body.trim().length < 10 || r.body.trim().length > 2000
      || !validDate(r.datePublished, today)) return [];
    ids.add(r.id);
    return [{ id: r.id, author: r.author.trim(), body: r.body.trim(),
      rating: r.rating, datePublished: r.datePublished }];
  }).sort((a, b) => b.datePublished.localeCompare(a.datePublished));
}

export function reviewSummary(reviews) {
  if (!reviews.length) return null;
  return { ratingValue: Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length * 100) / 100,
    reviewCount: reviews.length, bestRating: 5, worstRating: 1 };
}

export function reviewsLd(reviews, url) {
  const summary = reviewSummary(reviews);
  if (!summary) return {};
  return {
    aggregateRating: { '@type': 'AggregateRating', ...summary },
    review: reviews.map((r) => ({
      '@type': 'Review', '@id': `${url}#review-${r.id}`,
      author: { '@type': 'Person', name: r.author },
      reviewBody: r.body, datePublished: r.datePublished,
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    })),
  };
}
