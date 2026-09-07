/**
 * Cấu hình các khối (block) của trang chủ.
 *
 * Trang chủ = danh sách khối theo thứ tự trong `home_blocks` (content/vi/home.json):
 *   home_blocks: [ { id, type, enabled } ]
 *
 * - Các khối chuẩn (hero, about, services, stats, hot, values, cta) được render
 *   bằng component có sẵn (Hero, AboutTeaser, Services, Stats, Values, CTABand)
 *   và lấy nội dung từ các field có cấu trúc (hero_title, services_*, ...).
 * - Khối "custom" (tự do) là 1 ô SunEditor do admin soạn, body lưu ở key
 *   `home_custom_<id>` trong cùng file home.json.
 *
 * Module nằm src/lib/ nên KHÔNG bị copyLayout ghi đè.
 */

/** Mô tả từng loại khối + các field nội dung admin có thể sửa. */
export const HOME_BLOCK_TYPES = {
  hero: {
    label: 'Hero (banner đầu trang)',
    fields: ['hero_kicker', 'hero_title', 'hero_text', 'hero_cta_primary', 'hero_cta_secondary'],
  },
  about: {
    label: 'Giới thiệu nhanh',
    fields: ['about_teaser_kicker', 'about_teaser_title', 'about_teaser_text', 'about_teaser_cta'],
  },
  services: {
    label: 'Dịch vụ',
    fields: [
      'services_kicker', 'services_title', 'services_text',
      'service_ticket_title', 'service_ticket_text',
      'service_car_title', 'service_car_text',
      'service_team_title', 'service_team_text',
      'service_custom_title', 'service_custom_text',
    ],
  },
  stats: {
    label: 'Số liệu',
    fields: [
      'stats_years', 'stats_years_label',
      'stats_tours', 'stats_tours_label',
      'stats_customers', 'stats_customers_label',
      'stats_destinations', 'stats_destinations_label',
    ],
  },
  hot: {
    label: 'Tour hot (tiêu đề + lưới tour)',
    fields: ['hot_tours_kicker', 'hot_tours_title', 'hot_tours_text', 'view_all_tours'],
  },
  values: {
    label: 'Giá trị',
    fields: [
      'values_kicker', 'values_title', 'values_text',
      'value_1_title', 'value_1_text',
      'value_2_title', 'value_2_text',
      'value_3_title', 'value_3_text',
      'value_4_title', 'value_4_text',
    ],
  },
  cta: {
    label: 'Kêu gọi hành động (CTA)',
    fields: ['cta_kicker', 'cta_title', 'cta_text', 'cta_button'],
  },
  partners: {
    label: 'Đối tác (slider logo tự chạy)',
    fields: ['partners_title', 'partners_text'],
  },
  custom: {
    label: 'Khối tự do',
    fields: [],
  },
};

/** Thứ tự mặc định của các khối chuẩn. */
export const HOME_BLOCK_ORDER = ['hero', 'about', 'services', 'stats', 'hot', 'values', 'partners', 'cta'];

/** Danh sách khối mặc định (dùng khi home.json chưa có home_blocks). */
export const DEFAULT_HOME_BLOCKS = HOME_BLOCK_ORDER.map((type, i) => ({
  id: `blk-${type}`,
  type,
  enabled: true,
}));

/** Tiền tố key body của khối tự do. */
export const CUSTOM_BODY_PREFIX = 'home_custom_';

/** Key lưu body của khối tự do theo id. */
export const customBodyKey = (id) => `${CUSTOM_BODY_PREFIX}${id}`;

/** Nhãn hiển thị từng field nội dung cho admin. */
export const HOME_BLOCK_FIELD_LABELS = {
  hero_kicker: 'Chữ nhỏ (kicker)',
  hero_title: 'Tiêu đề lớn',
  hero_text: 'Mô tả',
  hero_cta_primary: 'Nút 1 — nhãn',
  hero_cta_secondary: 'Nút 2 — nhãn',

  about_teaser_kicker: 'Chữ nhỏ (kicker)',
  about_teaser_title: 'Tiêu đề',
  about_teaser_text: 'Mô tả',
  about_teaser_cta: 'Nút — nhãn',

  services_kicker: 'Chữ nhỏ (kicker)',
  services_title: 'Tiêu đề',
  services_text: 'Mô tả',
  service_ticket_title: '🎫 Vé máy bay — tiêu đề',
  service_ticket_text: '🎫 Vé máy bay — mô tả',
  service_car_title: '🚗 Cho thuê xe — tiêu đề',
  service_car_text: '🚗 Cho thuê xe — mô tả',
  service_team_title: '🤝 Teambuilding — tiêu đề',
  service_team_text: '🤝 Teambuilding — mô tả',
  service_custom_title: '🗺️ Tour yêu cầu — tiêu đề',
  service_custom_text: '🗺️ Tour yêu cầu — mô tả',

  stats_years: 'Năm kinh nghiệm (số)',
  stats_years_label: 'Năm kinh nghiệm — nhãn',
  stats_tours: 'Số tour (số)',
  stats_tours_label: 'Số tour — nhãn',
  stats_customers: 'Số khách hàng (số)',
  stats_customers_label: 'Số khách hàng — nhãn',
  stats_destinations: 'Số điểm đến (số)',
  stats_destinations_label: 'Số điểm đến — nhãn',

  hot_tours_kicker: 'Chữ nhỏ (kicker)',
  hot_tours_title: 'Tiêu đề',
  hot_tours_text: 'Mô tả',
  view_all_tours: 'Nhãn nút “Xem tất cả tour”',

  values_kicker: 'Chữ nhỏ (kicker)',
  values_title: 'Tiêu đề',
  values_text: 'Mô tả',
  value_1_title: 'Giá trị 1 — tiêu đề',
  value_1_text: 'Giá trị 1 — mô tả',
  value_2_title: 'Giá trị 2 — tiêu đề',
  value_2_text: 'Giá trị 2 — mô tả',
  value_3_title: 'Giá trị 3 — tiêu đề',
  value_3_text: 'Giá trị 3 — mô tả',
  value_4_title: 'Giá trị 4 — tiêu đề',
  value_4_text: 'Giá trị 4 — mô tả',

  cta_kicker: 'Chữ nhỏ (kicker)',
  cta_title: 'Tiêu đề',
  cta_text: 'Mô tả',
  cta_button: 'Nhãn nút',

  partners_title: 'Tiêu đề (mặc định: Đối tác)',
  partners_text: 'Mô tả nhỏ (để trống nếu không cần)',
};
