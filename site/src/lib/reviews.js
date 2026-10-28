import { getContent } from './content.js';
import { normalizeReviews } from './review-data.js';
export * from './review-data.js';

export function getReviewContent(lang = 'vi') {
  return getContent(lang, 'tour-reviews');
}

export function getTourReviews(lang, slug) {
  return normalizeReviews(getReviewContent(lang).reviews, slug);
}

