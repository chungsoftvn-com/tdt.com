/**
 * Schema trình soạn trang tĩnh cho Admin.
 * Mỗi page: label + sections[ { title, fields[ {key, label, type:'text'|'textarea'} ] } ].
 * Lưu/đọc qua Worker API /api/pages/<name> (ghi content/vi/<name>.json).
 * Module nằm src/lib/ nên KHÔNG bị copyLayout ghi đè.
 */
export const PAGE_SCHEMAS = {
  home: {
    label: 'Trang chủ',
    file: 'home',
    // Trang chủ = danh sách khối (block). Admin thêm/xoá/ẩn/sắp xếp từng khối
    // (blockManager) + tickbox chọn tour hot + khối tự do chèn
    // ở vị trí bất kỳ. Không còn "Chỉnh sửa HTML" nội dung chính.
    mode: 'homeBlocks',
    blockManager: true,
    hotTours: true, // tickbox chọn tour hiện ở mục "Tour hot"
    sections: [
      {
        title: 'Tiêu đề các mục trang chủ',
        fields: [
          { key: 'featured_destinations_title', label: 'Tiêu đề điểm đến nổi bật', type: 'text' },
          { key: 'trip_moments_title', label: 'Tiêu đề khoảnh khắc hành trình', type: 'text' },
          { key: 'facebook_section_title', label: 'Tiêu đề mục Facebook', type: 'text' },
          { key: 'facebook_section_text', label: 'Mô tả mục Facebook', type: 'textarea' },
          { key: 'facebook_cta_label', label: 'Nhãn liên kết Facebook', type: 'text' },
          { key: 'facebook_followers', label: 'Số người theo dõi Facebook', type: 'text' },
          { key: 'facebook_followers_label', label: 'Nhãn người theo dõi Facebook', type: 'text' },
          { key: 'facebook_bio', label: 'Giới thiệu Facebook', type: 'textarea' },
        ],
      },
    ],
  },

  about: {
    label: 'Giới thiệu',
    file: 'about',
    // Toàn bộ nội dung trong MỘT ô soạn thảo full-document duy nhất (text + ảnh đan xen)
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo đầy đủ — text + ảnh đan xen)',
    fullEditor: true,
    sections: [{ title: 'Toàn bộ nội dung', body: true }],
  },

  contact: {
    label: 'Liên hệ',
    file: 'contact',
    // Toàn bộ nội dung (ngoại trừ form) trong MỘT ô soạn thảo full-document duy nhất
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo đầy đủ — như soạn tài liệu; không gồm form)',
    fullEditor: true,
    sections: [{ title: 'Toàn bộ nội dung', body: true }],
  },

  'tim-tour': {
    label: 'Trang Tìm tour',
    file: 'tim-tour',
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo — text + ảnh)',
    fullEditor: true,
    sections: [{ title: 'Toàn bộ nội dung', body: true }],
  },
  'dat-tour': {
    label: 'Trang Đặt tour',
    file: 'dat-tour',
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo — text + ảnh)',
    fullEditor: true,
    sections: [{ title: 'Toàn bộ nội dung', body: true }],
  },
  'y-kien-khach-hang': {
    label: 'Trang Ý kiến khách hàng',
    file: 'testimonials',
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo — text + ảnh)',
    fullEditor: true,
    sections: [{ title: 'Toàn bộ nội dung', body: true }],
  },
  'doi-tac': {
    label: 'Trang Đối tác',
    file: 'partners',
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo — text + ảnh)',
    fullEditor: true,
    sections: [{ title: 'Toàn bộ nội dung', body: true }],
  },
  'tuyen-dung': {
    label: 'Trang Tuyển dụng',
    file: 'tuyen-dung',
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo — text + ảnh)',
    fullEditor: true,
    sections: [{ title: 'Toàn bộ nội dung', body: true }],
  },
  'chi-duong': {
    label: 'Trang Chỉ đường',
    file: 'chi-duong',
    bodyKey: 'body_html',
    bodyLabel: 'Toàn bộ nội dung (một ô soạn thảo — text + ảnh)',
    fullEditor: true,
    sections: [
      {
        title: 'Bản đồ Google Maps — dán link vào đây',
        // Admin chỉ cần mở Google Maps → Chia sẻ → Sao chép link → dán vào ô dưới.
        // Nhận mọi dạng link: maps.app.goo.gl/…, google.com/maps/place/…,
        // google.com/maps/@lat,lng…, link chỉ đường /maps/dir/…
        fields: [
          {
            key: 'map_url',
            label: 'Link Google Maps (link bản đồ hoặc link chỉ đường)',
            type: 'text',
          },
          { key: 'map_note', label: 'Ghi chú dưới bản đồ (tuỳ chọn)', type: 'text' },
        ],
      },
      { title: 'Toàn bộ nội dung', body: true },
    ],
  },

  support: {
    label: 'Liên hệ nhanh (sidebar)',
    file: 'support',
    // Sidebar bám mép trái ở mọi trang (đại diện = icon điện thoại).
    sections: [
      {
        title: 'Sidebar hỗ trợ',
        fields: [
          { key: 'title', label: 'Tiêu đề sidebar', type: 'text' },
          { key: 'note', label: 'Ghi chú nhỏ dưới tiêu đề', type: 'text' },
          {
            key: 'items_text',
            label: 'Danh sách liên hệ — mỗi dòng: Chức danh | Tên | Số điện thoại',
            type: 'textarea',
          },
        ],
      },
    ],
  },

  common: {
    label: 'Header & Footer',
    file: 'common',
    // Shared header/footer copy and editable rich-text footer columns.
    fullEditor: true,
    sections: [
      {
        title: 'Thương hiệu, tìm kiếm & menu đầu trang',
        fields: [
          { key: 'brand_name', label: 'Tên thương hiệu', type: 'text' },
          { key: 'brand_tagline', label: 'Tagline', type: 'text' },
          { key: 'meta_title', label: 'Meta title', type: 'text' },
          { key: 'meta_description', label: 'Meta description', type: 'textarea' },
          { key: 'header_search_placeholder', label: 'Ô tìm kiếm trên header', type: 'text' },
          { key: 'home_search_placeholder', label: 'Ô tìm kiếm trên trang chủ', type: 'text' },
          { key: 'nav_more_label', label: 'Nhãn menu mở rộng (trợ năng)', type: 'text' },
          { key: 'nav_primary_label', label: 'Nhãn menu desktop (trợ năng)', type: 'text' },
          { key: 'nav_mobile_label', label: 'Nhãn menu mobile (trợ năng)', type: 'text' },
          { key: 'nav_home', label: 'Menu — Trang chủ', type: 'text' },
          { key: 'nav_about', label: 'Menu — Giới thiệu', type: 'text' },
          { key: 'nav_tours', label: 'Menu — Tour', type: 'text' },
          { key: 'region_domestic', label: 'Menu — Tour trong nước', type: 'text' },
          { key: 'region_international', label: 'Menu — Tour nước ngoài', type: 'text' },
          { key: 'nav_contact', label: 'Menu — Liên hệ', type: 'text' },
          { key: 'nav_news', label: 'Menu — Tin tức', type: 'text' },
          { key: 'nav_tickets', label: 'Menu — Vé máy bay', type: 'text' },
          { key: 'nav_car', label: 'Menu — Cho thuê xe', type: 'text' },
          { key: 'nav_book', label: 'Menu — Đặt tour', type: 'text' },
          { key: 'nav_testimonials', label: 'Menu — Khách hàng', type: 'text' },
          { key: 'nav_partners', label: 'Menu — Đối tác', type: 'text' },
          { key: 'nav_recruit', label: 'Menu — Tuyển dụng', type: 'text' },
          { key: 'nav_directions', label: 'Menu — Chỉ đường', type: 'text' },
          { key: 'nav_find_tour', label: 'Nút tìm tour', type: 'text' },
          { key: 'cta_book', label: 'Nút đặt tour', type: 'text' },
          { key: 'cta_call', label: 'Nút gọi tư vấn', type: 'text' },
          { key: 'duration', label: 'Nhãn thời lượng tour', type: 'text' },
          { key: 'departure_label', label: 'Nhãn khởi hành', type: 'text' },
          { key: 'price', label: 'Nhãn giá tour', type: 'text' },
          { key: 'tour_hot_label', label: 'Nhãn tour nổi bật', type: 'text' },
          { key: 'cta_details', label: 'Nút xem chi tiết tour', type: 'text' },
          { key: 'read_more', label: 'Nút xem thêm tin tức', type: 'text' },
          { key: 'hotline_label', label: 'Nhãn hotline', type: 'text' },
          { key: 'hotline', label: 'Hotline', type: 'text' },
          { key: 'hotline_owner', label: 'Người phụ trách hotline', type: 'text' },
          { key: 'zalo_label', label: 'Nhãn zalo', type: 'text' },
          { key: 'zalo', label: 'Zalo', type: 'text' },
          { key: 'zalo_owner', label: 'Người phụ trách zalo', type: 'text' },
          { key: 'email_label', label: 'Nhãn email', type: 'text' },
          { key: 'email', label: 'Email', type: 'text' },
          { key: 'website_label', label: 'Nhãn website', type: 'text' },
          { key: 'website', label: 'Website', type: 'text' },
          { key: 'address_label', label: 'Nhãn địa chỉ', type: 'text' },
          { key: 'address', label: 'Địa chỉ', type: 'textarea' },
        ],
      },
      {
        title: 'Nội dung footer',
        fields: [
          { key: 'footer_about_text', label: 'Mô tả thương hiệu', type: 'textarea' },
          { key: 'footer_quick_title', label: 'Tiêu đề cột dịch vụ', type: 'text' },
          { key: 'footer_contact_title', label: 'Tiêu đề cột thông tin', type: 'text' },
          { key: 'footer_offer', label: 'Tiêu đề đăng ký nhận tin', type: 'text' },
          { key: 'footer_email_placeholder', label: 'Gợi ý ô email', type: 'text' },
          { key: 'footer_newsletter_submit', label: 'Nút đăng ký nhận tin', type: 'text' },
          { key: 'footer_newsletter_success', label: 'Thông báo đăng ký', type: 'text' },
          { key: 'footer_social_title', label: 'Tiêu đề mạng xã hội', type: 'text' },
          { key: 'footer_facebook', label: 'Nhãn Facebook', type: 'text' },
          { key: 'footer_tiktok', label: 'Nhãn TikTok', type: 'text' },
          { key: 'footer_zalo', label: 'Nhãn Zalo', type: 'text' },
          { key: 'rights', label: 'Thông báo bản quyền', type: 'text' },
          { key: 'footer_credit', label: 'Dòng ghi công cuối trang', type: 'text' },
          { key: 'skip_to_content', label: 'Liên kết bỏ qua nội dung (trợ năng)', type: 'text' },
          { key: 'partners_prev', label: 'Nhãn nút đối tác — trước (trợ năng)', type: 'text' },
          { key: 'partners_next', label: 'Nhãn nút đối tác — tiếp (trợ năng)', type: 'text' },
          { key: 'sales_title', label: 'Tiêu đề mục tư vấn trên trang chủ', type: 'text' },
        ],
      },
      { title: 'Cột giới thiệu', body: { key: 'body_html', label: 'Nội dung cột giới thiệu' } },
      { title: 'Cột truy cập nhanh', body: { key: 'footer_quick_body', label: 'Nội dung cột truy cập nhanh' } },
      { title: 'Cột liên hệ', body: { key: 'footer_contact_body', label: 'Nội dung cột liên hệ' } },
      { title: 'Cột mạng xã hội', body: { key: 'footer_social_body', label: 'Nội dung cột mạng xã hội' } },
      { title: 'Điều khoản & Lưu ý tour', body: { key: 'tour_terms_body', label: 'Nội dung Điều khoản & Lưu ý (hiện ở trang chi tiết tour)' } },
      { title: 'Tư vấn & Kinh doanh (trang chủ)', body: { key: 'sales_body_html', label: 'Nội dung mục Tư vấn & Kinh doanh' } },
    ],
  },
};

/** Danh sách trang (thứ tự hiển thị). */
export const PAGE_LIST = Object.keys(PAGE_SCHEMAS).map((k) => ({
  key: k,
  label: PAGE_SCHEMAS[k].label,
  file: PAGE_SCHEMAS[k].file,
}));
