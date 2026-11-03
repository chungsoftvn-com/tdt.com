import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { withoutLegacyTourContact } from '../src/features/contact/contact-blocks.js';
import { fixContentImages } from '../src/features/contact/image-quality.js';
import { richDoc } from '../src/lib/rich.js';

test('legacy contact fields are removed but itinerary, FAQ, privacy and related links survive', () => {
  const answer = { type: 'p', text: 'Được. Liên hệ 0902 898 726 để thiết kế đoàn riêng.' };
  const privacy = { type: 'list', items: ['Có thể yêu cầu xóa dữ liệu qua 0902 898 726.'] };
  const itinerary = { type: 'p', text: 'Ngày 2: tham quan và nghỉ tại khách sạn.' };
  const related = { type: 'p', text: '<a href="/vi/tours/tour-da-lat-3n2d/">Tour Đà Lạt</a>' };
  const blocks = [itinerary, { type: 'h3', text: 'Có thể đi đoàn riêng không?' }, answer, privacy,
    { type: 'h3', text: '📞 THÔNG TIN LIÊN HỆ ĐẶT TOUR' },
    { type: 'p', text: 'Mr. Anh Văn – Phòng Kinh doanh: 0902 898 726' }, related];
  assert.deepEqual(withoutLegacyTourContact(blocks), [itinerary, blocks[1], answer, privacy, related]);
});

test('image repairs preserve figures, captions and the original transparent logo class', () => {
  const src = '/content/vi/images/han-quoc-anh-noi-dung-opt.jpg';
  const html = `<figure class="original"><img src="${src}" width="1200"><figcaption>Cung điện</figcaption></figure>`;
  const fixed = fixContentImages(html);
  assert.match(fixed, /class="original content-photo-branded"/);
  assert.match(fixed, /width:auto;max-width:100%;height:auto/);
  assert.match(fixed, /<figcaption>Cung điện<\/figcaption>/);
  assert.match(richDoc(html), /content-photo-branded/);
  assert.match(fixContentImages('<figure><img src="/unknown.jpg" alt="Original"></figure>'), /src="\/unknown.jpg" alt="Original"/);
});

test('the invalid event image is not rendered and every substitution asset exists', () => {
  const bad = '/content/vi/images/15-nam-hanh-trinh-vuon-xa-vuot-qua-gioi-han-06-30.jpg';
  assert.equal(fixContentImages(`<figure><img src="${bad}"></figure>`), '');
  const manifest = JSON.parse(readFileSync(new URL('../src/features/contact/image-quality.json', import.meta.url)));
  const root = new URL('../../', import.meta.url);
  for (const { src } of Object.values(manifest.replacements)) {
    assert.ok(existsSync(fileURLToPath(new URL(src.slice(1), root))), src);
  }
});
