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
    // (blockManager) + tickbox chọn tour hot + khối tự do (SunEditor) chèn
    // ở vị trí bất kỳ. Không còn "Chỉnh sửa HTML" nội dung chính.
    mode: 'homeBlocks',
    blockManager: true,
    hotTours: true, // tickbox chọn tour hiện ở mục "Tour hot"
    sections: [],
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

  common: {
    label: 'Footer',
    file: 'common',
    // 4 cột footer = 4 ô soạn thảo + mở lại header fields
    fullEditor: true,
    sections: [
      {
        title: 'Thương hiệu / Header',
        fields: [
          { key: 'brand_name', label: 'Tên thương hiệu', type: 'text' },
          { key: 'brand_tagline', label: 'Tagline', type: 'text' },
          { key: 'meta_title', label: 'Meta title', type: 'text' },
          { key: 'meta_description', label: 'Meta description', type: 'textarea' },
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
      { title: 'Cột giới thiệu', body: { key: 'body_html', label: 'Nội dung cột giới thiệu' } },
      { title: 'Cột truy cập nhanh', body: { key: 'footer_quick_body', label: 'Nội dung cột truy cập nhanh' } },
      { title: 'Cột liên hệ', body: { key: 'footer_contact_body', label: 'Nội dung cột liên hệ' } },
      { title: 'Cột mạng xã hội', body: { key: 'footer_social_body', label: 'Nội dung cột mạng xã hội' } },
    ],
  },
};

/** Danh sách trang (thứ tự hiển thị). */
export const PAGE_LIST = Object.keys(PAGE_SCHEMAS).map((k) => ({
  key: k,
  label: PAGE_SCHEMAS[k].label,
  file: PAGE_SCHEMAS[k].file,
}));
