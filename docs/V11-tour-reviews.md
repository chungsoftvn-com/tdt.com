# V11 – Đánh giá sao từng tour

Ngày triển khai: 28/10/2026. Anh Văn xác nhận hiện chỉ có đánh giá Google Maps.

## Hành vi

- Mỗi trang tour có mục `#danh-gia-tour`, biểu mẫu 1–5 sao, tên hiển thị, ngày đi, nhận xét và đồng ý công bố.
- Nút gửi mở ứng dụng email với bản nháp gửi tới email công ty trong `common.json`. Khách phải bấm Gửi trong ứng dụng email. Website không báo đã nhận khi chưa gửi.
- Nếu thiết bị không cấu hình email, nội dung vẫn hiện để khách sao chép gửi qua email.
- Chưa có backend lưu review tự động. Sau khi đối chiếu khách/chuyến đi và được khách cho phép, người phụ trách nhập đánh giá vào `content/vi/tour-reviews.json` qua Git và triển khai lại.
- Google Maps là liên kết đánh giá công ty riêng, không sao chép điểm/số lượt thành đánh giá tour.
- Bộ dữ liệu ban đầu rỗng: không có điểm mặc định, review giả hoặc AggregateRating với 0 lượt.
- UI và Review/AggregateRating dùng cùng dữ liệu đã lọc; cả 1–5 sao đều được tính. Không chỉ đăng đánh giá tích cực.

## Nhập đánh giá đã nhận trực tiếp

Chỉ thêm đánh giá đã xác minh và được khách cho phép công bố vào `reviews`. Bản nháp/chưa đồng ý công bố phải giữ trong hồ sơ nội bộ, không lưu trong file JSON công khai. Không đưa dữ liệu thử nghiệm lên bản chính.

| Trường | Nội dung |
|---|---|
| id | Mã duy nhất, chữ thường/số/dấu gạch ngang |
| tourSlug | Slug đúng tour khách đã đi |
| author | Tên hiển thị khách đồng ý công bố, 2–80 ký tự |
| rating | Số nguyên 1–5, do chính khách chấm |
| body | Nhận xét nguyên ý khách, 10–2000 ký tự |
| datePublished | Ngày công bố YYYY-MM-DD, không ghi tương lai |
| source | `direct` (khách gửi trực tiếp cho TodayTourist) |
| verified | `true` sau khi đối chiếu chuyến đi |
| consent | `true` khi có đồng ý công bố |
| status | `published` sau xác minh; bản nháp giữ ngoài kho mã công khai |

Giữ bằng chứng khách gửi và đồng ý ở hồ sơ nội bộ; KHÔNG đưa email, số điện thoại, mã đặt chỗ hoặc tin nhắn riêng tư vào JSON công khai. Không quy đổi lời cảm ơn/bài tổng kết đoàn thành số sao. Không nhập điểm Google Maps/Facebook, dù cùng tuyến tour. Không đề nghị quà/giảm giá để đổi lấy điểm tốt.

## Kiểm tra trước bàn giao

1. `cd site && node --test tests/reviews.test.mjs`.
2. `node scripts/copy-layout.mjs && node scripts/gen-lastmod.mjs && npm run build` (đúng thứ tự CI).
3. Mở trang tour: tên, số sao, nhận xét, tổng lượt phải khớp JSON-LD. Trang không có review không có Review/AggregateRating.
4. Rich Results Test: https://search.google.com/test/rich-results . Khi có review thật, thử trang đó rồi yêu cầu thu thập lại trong Search Console. Dữ liệu hợp lệ không đảm bảo Google sẽ hiện sao hoặc tăng thứ hạng.

Nguồn: https://developers.google.com/search/docs/appearance/structured-data/review-snippet và https://developers.google.com/search/docs/appearance/structured-data/product-snippet .
