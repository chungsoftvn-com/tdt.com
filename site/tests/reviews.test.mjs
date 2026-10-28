import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReviews, reviewSummary, reviewsLd } from '../src/lib/review-data.js';
import { buildReviewEmail } from '../src/features/reviews/review-email.js';

const slug = 'tour-test';
const today = '2026-10-28';
const valid = { id: 'review-1', tourSlug: slug, author: 'Khách kiểm thử', rating: 5,
  body: 'Dữ liệu kiểm thử, không được xuất bản trên website.', datePublished: today,
  status: 'published', source: 'direct', verified: true, consent: true };
const read = (records) => normalizeReviews(records, slug, today);

test('no reviews never produces zero or fabricated rating markup', () => {
  for (const records of [null, {}, [], [null]]) assert.deepEqual(read(records), []);
  assert.equal(reviewSummary([]), null);
  assert.deepEqual(reviewsLd([], 'https://example.test/tour/'), {});
});

test('only published, direct reviews of this tour with verification and consent count', () => {
  for (const patch of [{ tourSlug: 'other-tour' }, { status: 'pending' }, { source: 'google-maps' },
    { source: 'facebook' }, { verified: false }, { consent: false }, { rating: 0 }, { rating: 6 },
    { rating: 4.9 }, { rating: '5' }, { author: '' }, { body: 'short' },
    { datePublished: '2026-02-30' }, { datePublished: '2026-10-29' }]) {
    assert.deepEqual(read([{ ...valid, ...patch }]), [], JSON.stringify(patch));
  }
});

test('all genuine ratings including low ratings contribute; duplicates do not', () => {
  const records = read([valid, valid, { ...valid, id: 'review-2', rating: 1 }]);
  assert.equal(records.length, 2);
  assert.deepEqual(reviewSummary(records), { ratingValue: 3, reviewCount: 2, bestRating: 5, worstRating: 1 });
  const schema = reviewsLd(records, 'https://example.test/tour/');
  assert.equal(schema.review.length, schema.aggregateRating.reviewCount);
  assert.deepEqual(schema.review.map(r => r.reviewRating.ratingValue), [5, 1]);
  assert.ok(schema.review.every(r => r['@id'].startsWith('https://example.test/tour/#review-')));
});

test('summary and structured data preserve the visible review text and authors', () => {
  const reviews = read([valid]);
  const schema = reviewsLd(reviews, 'https://example.test/tour/');
  assert.equal(schema.review[0].author.name, reviews[0].author);
  assert.equal(schema.review[0].reviewBody, reviews[0].body);
  assert.equal(schema.aggregateRating.ratingValue, 5);
  assert.equal('email' in schema.review[0].author, false);
});

test('email draft safely encodes customer text and identifies the precise tour', () => {
  const review = { email: 'reviews@example.test', tour: 'Tour thử', url: 'https://example.test/tour/',
    subject: 'Đánh giá', consent: 'Đồng ý công bố', author: 'An & Bình', rating: '2',
    tripDate: '2026-10-01', body: 'Góp ý & subject=không-thay-đổi' };
  const draft = buildReviewEmail(review);
  const url = new URL(draft.href);
  assert.equal(url.searchParams.get('subject'), 'Đánh giá: Tour thử');
  assert.equal(url.searchParams.get('body'), draft.body);
  assert.ok(draft.body.includes('Số sao: 2/5'));
  assert.ok(draft.body.includes(review.url));
  assert.throws(() => buildReviewEmail({ ...review, rating: '' }));
});
