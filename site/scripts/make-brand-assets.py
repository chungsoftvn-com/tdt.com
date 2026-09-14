#!/usr/bin/env python3
"""Sinh bộ icon + ảnh chia sẻ mặc định (SEO) cho site.

Ghi ra `site/public/`:
    favicon-192.png, favicon-512.png, apple-touch-icon.png  — icon vuông thương hiệu
    og-default.jpg                                         — 1200x630 cho og:image mặc định

Các file dưới đây KHÔNG sinh ở đây (viết tay): `favicon.svg`, `site.webmanifest`.

Cần: pip install pillow
Chạy: python site/scripts/make-brand-assets.py

Chạy lại khi đổi palette thương hiệu (màu lấy từ site/src/styles/global.css).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

# Palette — phải khớp token trong site/src/styles/global.css
SAND = (250, 246, 238)
SEA = (15, 118, 110)
SEA_DEEP = (17, 94, 89)
ACCENT = (249, 115, 22)
INK = (31, 42, 55)
INK_SOFT = (92, 102, 114)

FONT_BOLD_CANDIDATES = (
    r"C:\Windows\Fonts\segoeuib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)
FONT_REGULAR_CANDIDATES = (
    r"C:\Windows\Fonts\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def load_font(candidates, size):
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def draw_centered(draw, box, text, fnt, fill):
    """Vẽ `text` căn giữa trong box (left, top, right, bottom) theo bbox thật."""
    left, top, right, bottom = box
    bbox = draw.textbbox((0, 0), text, font=fnt)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = left + (right - left - w) / 2 - bbox[0]
    y = top + (bottom - top - h) / 2 - bbox[1]
    draw.text((x, y), text, font=fnt, fill=fill)


def make_icon(size):
    """Icon vuông: nền sea bo góc, chữ T màu sand, chấm accent góc dưới phải."""
    scale = 4  # vẽ lớn rồi thu nhỏ -> cạnh mượt
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=SEA)
    draw_centered(draw, (0, 0, s, int(s * 0.94)), "T", load_font(FONT_BOLD_CANDIDATES, int(s * 0.66)), SAND)
    dot = int(s * 0.15)
    off = int(s * 0.11)
    draw.ellipse((s - dot - off, s - dot - off, s - off, s - off), fill=ACCENT)
    return img.resize((size, size), Image.LANCZOS)


def make_og_image():
    """Ảnh chia sẻ mặc định 1200x630 (Facebook/Zalo/Twitter card)."""
    width, height = 1200, 630
    bar = 108  # chiều cao dải thông tin dưới
    img = Image.new("RGB", (width, height), SAND)
    draw = ImageDraw.Draw(img)

    # Khối thương hiệu (icon) + chữ
    draw.rounded_rectangle((72, 86, 72 + 96, 86 + 96), radius=22, fill=SEA)
    draw_centered(draw, (72, 86, 72 + 96, 86 + 96), "T", load_font(FONT_BOLD_CANDIDATES, 64), SAND)

    draw.text((196, 96), "TODAYTOURIST", font=load_font(FONT_BOLD_CANDIDATES, 60), fill=INK)
    draw.text(
        (196, 166),
        "Cùng bạn đi khắp năm châu",
        font=load_font(FONT_REGULAR_CANDIDATES, 30),
        fill=SEA_DEEP,
    )

    draw.line((72, 248, width - 72, 248), fill=ACCENT, width=6)

    for i, line in enumerate(
        (
            "Tour trong nước & quốc tế  ·  Vé máy bay",
            "Cho thuê xe  ·  Teambuilding & sự kiện",
        )
    ):
        draw.text(
            (72, 296 + i * 52),
            line,
            font=load_font(FONT_REGULAR_CANDIDATES, 38),
            fill=INK_SOFT,
        )

    # Dải dưới: website + hotline
    draw.rectangle((0, height - bar, width, height), fill=SEA_DEEP)
    draw.text(
        (72, height - bar + 34),
        "todaytourist.com",
        font=load_font(FONT_BOLD_CANDIDATES, 36),
        fill=SAND,
    )
    hotline = "Hotline 0913.78.76.47"
    fnt = load_font(FONT_REGULAR_CANDIDATES, 36)
    w = draw.textbbox((0, 0), hotline, font=fnt)[2]
    draw.text((width - 72 - w, height - bar + 34), hotline, font=fnt, fill=(255, 237, 213))

    return img


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)

    for size, name in ((192, "favicon-192.png"), (512, "favicon-512.png"), (180, "apple-touch-icon.png")):
        make_icon(size).save(PUBLIC / name)
        print(f"[brand] {name} ({size}x{size})")

    og = PUBLIC / "og-default.jpg"
    make_og_image().save(og, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"[brand] {og.name} (1200x630, {og.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
