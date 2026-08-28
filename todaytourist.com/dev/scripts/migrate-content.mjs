#!/usr/bin/env node
/**
 * Migration 1 lần: chuyển content từ dạng "phẳng" (tours.json chứa tour_1_*)
 * sang dạng "1 file / 1 bài" mà Worker admin ghi:
 *
 *   content/vi/tours.json            -> INDEX { count, list_title, list_text, order[] }
 *   content/vi/tours/<slug>.json     -> dữ liệu từng tour
 *   content/vi/news.json             -> INDEX tin tức
 *   content/vi/news/<slug>.json      -> dữ liệu từng tin
 *
 * Đồng thời seed sẵn vài bài tin tức mẫu (nếu chưa có).
 *
 * Cách chạy: node scripts/migrate-content.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vi = path.join(ROOT, 'content', 'vi');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Migrate tours: tours.json (flat) -> tours/<slug>.json + index.order[] */
function migrateTours() {
  const indexFile = path.join(vi, 'tours.json');
  const data = readJson(indexFile);
  if (!data) {
    console.log('[migrate] content/vi/tours.json không tồn tại — bỏ qua.');
    return;
  }
  if (Array.isArray(data.order)) {
    console.log('[migrate] tours đã migrate (có order) — bỏ qua.');
    return;
  }

  const count = Number(data.count) || 0;
  const order = [];
  for (let i = 1; i <= count; i += 1) {
    const slug = data[`tour_${i}_slug`];
    if (!slug) continue;
    const tour = {
      slug,
      name: data[`tour_${i}_name`] ?? '',
      region: data[`tour_${i}_region`] ?? 'domestic',
      region_name: data[`tour_${i}_region_name`] ?? '',
      duration: data[`tour_${i}_duration`] ?? '',
      price: data[`tour_${i}_price`] ?? '',
      image: data[`tour_${i}_image`] ?? '',
      desc: data[`tour_${i}_desc`] ?? '',
      highlights: String(data[`tour_${i}_highlights`] ?? '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean),
      itinerary: [],
    };
    writeJson(path.join(vi, 'tours', `${slug}.json`), tour);
    order.push(slug);
  }

  const { list_title, list_text } = data;
  writeJson(indexFile, { count: order.length, list_title, list_text, order });
  console.log(`[migrate] Tours: ${order.length} bài -> content/vi/tours/<slug>.json + index.order.`);
}

/** Seed news (chỉ chạy nếu chưa có index news.json). */
function seedNews() {
  const indexFile = path.join(vi, 'news.json');
  if (fs.existsSync(indexFile)) {
    console.log('[migrate] news.json đã tồn tại — bỏ qua seed.');
    return;
  }
  const articles = [
    {
      slug: 'le-hoi-khinh-khi-cau-mang-den-2026',
      title: 'Lễ hội khinh khí cầu Măng Đen 2026',
      category: 'Tin du lịch',
      image: '',
      summary: 'Cơ hội chiêm ngưỡng hàng chục khinh khí cầu đủ màu sắc bay trên bầu trời cao nguyên Măng Đen (Kon Tum) dịp đầu năm 2026.',
      body: '## Điểm hẹn của những trái bóng bay khổng lồ\n\nLễ hội khinh khí cầu Măng Đen 2026 dự kiến diễn ra vào dịp đầu năm, quy tụ nhiều khinh khí cầu trong nước và quốc tế. Du khách sẽ được bay khinh khí cầu ngắm toàn cảnh rừng thông, hồ nước và thị trấn Măng Đen từ trên cao.\n\n- Bay khinh khí cầu bình minh\n- Triển lãm khinh khí cầu ban đêm (night glow)\n- Các hoạt động văn hóa, ẩm thực Tây Nguyên\n\n**TodayTourist** có tour trọn gói đưa đón, đặt khách sạn và hướng dẫn viên kinh nghiệm.',
      published_at: '2026-01-10',
    },
    {
      slug: 'festival-hoa-kieng-sa-dec-2025',
      title: 'Festival hoa kiểng Sa Đéc lần thứ 2',
      category: 'Tin du lịch',
      image: '',
      summary: 'Làng hoa Sa Đéc (Đồng Tháp) khoác lên mình sắc màu rực rỡ với hàng trăm loài hoa kiểng khoe sắc dịp festival.',
      body: '## Vương quốc hoa giữa lòng miền Tây\n\nFestival hoa kiểng Sa Đéc lần thứ 2 diễn ra từ 27/12 đến 4/1, quy tụ 20 hoạt động chính và 12 hoạt động hưởng ứng với nhiều tiểu cảnh hoa ấn tượng.\n\nDu khách có thể tham quan làng hoa, chụp ảnh cùng các vườn hoa rực rỡ, trải nghiệm làm hoa giấy và thưởng thức đặc sản miền Tây.\n\nĐặt tour làng hoa Sa Đéc 1 ngày cùng TodayTourist: xe đưa đón, hướng dẫn viên tận tình.',
      published_at: '2025-12-20',
    },
    {
      slug: 'todaytourist-kinh-nghiem-du-lich-bien-he',
      title: 'Kinh nghiệm du lịch biển mùa hè không sót gì',
      category: 'Cẩm nang',
      image: '',
      summary: 'Bỏ túi những kinh nghiệm du lịch biển: thời điểm đẹp, đồ cần mang, ăn uống và cách chọn tour phù hợp với gia đình.',
      body: '## Du lịch biển — chọn thời điểm và điểm đến\n\nMùa hè là thời điểm lý tưởng để tắm biển. Các điểm biển gần Sài Gòn như Vũng Tàu, Phan Thiết, Nha Trang đều phù hợp cho kỳ nghỉ 2-3 ngày.\n\n**Lưu ý khi đi biển:**\n- Mang kem chống nắng, mũ, kính râm\n- Đặt khách sạn gần biển, view đẹp\n- Chọn tour có xe đưa đón để thuận tiện\n\nLiên hệ TodayTourist để được tư vấn tour biển phù hợp cho gia đình, nhóm bạn hay công ty.',
      published_at: '2026-03-15',
    },
  ];

  const order = articles.map((a) => a.slug);
  for (const a of articles) {
    writeJson(path.join(vi, 'news', `${a.slug}.json`), a);
  }
  writeJson(indexFile, { count: order.length, list_title: 'Tin tức', list_text: 'Cập nhật tin tức du lịch, cẩm nang và ưu đãi mới nhất từ TodayTourist.', order });
  console.log(`[migrate] News: seed ${order.length} bài -> content/vi/news/<slug>.json + index.`);
}

migrateTours();
seedNews();
console.log('[migrate] Xong. Chạy lại build để site dùng cấu trúc mới.');
