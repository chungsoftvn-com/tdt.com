#!/usr/bin/env python3
"""
Translate Vietnamese JSON content files to English using Argos Translate.

Usage:
    python scripts/translate.py                 # vi -> en for all files under content/
    python scripts/translate.py --source vi --target en --lang-dir content

Behaviour:
  * Reads every *.json file in <lang-dir>/<source>/ and writes a translated
    copy to <lang-dir>/<target>/.
  * Only string leaf values are translated. Numbers / booleans pass through.
  * Keys that must stay machine-readable (slugs, image names, prices, phones,
    emails, urls, region keys, counters) are never translated.
  * Proper nouns (brand name, company info, addresses, contact names) are kept
    as-is so the machine model cannot corrupt them.
  * Values containing "|" (e.g. tour highlights) are split, translated segment
    by segment, then re-joined — this avoids the model mangling a whole list.
  * A curated QA layer (content/overrides.en.json) is applied on top of the
    machine output for critical UI labels. Lookup order: "<file>/<key>", then
    "<key>". This is the standard "machine translation + human review" flow.
  * If Argos Translate is not installed, it falls back to:
       1) re-using existing <target> files if present, else
       2) copying the source values unchanged (with a warning).
    This keeps `npm run build` working even before Argos is set up.

Exit code 0 on success (even with fallback), 2 on hard errors.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# Các file có bản EN biên soạn THỦ CÔNG — không ghi đè khi file đích đã tồn tại.
MANUAL_EN = {"ve-may-bay", "cho-thue-xe"}

# Keys (by exact name) that must never be translated (proper nouns / codes).
SKIP_KEY_EXACT = {
    "count",
    "brand_name",
    "meta_keywords",
    "hotline",
    "hotline_owner",
    "zalo",
    "zalo_owner",
    "email",
    "website",
    "address",
    "lang_code_vi",
    "lang_code_en",
    "company_name",
    "company_address",
    "company_hotline",
    "company_email",
    "company_website",
    "contact_1",
    "contact_2",
    "contact_3",
    "contact_4",
    "info_address",
    "info_hotline",
    "info_zalo",
    "info_email",
    "info_website",
    # Cấu trúc 1 file / 1 bài: các key máy (slug, ảnh, vùng, order, ngày)
    "slug",
    "image",
    "region",
    "order",
    "published_at",
    # Khối nội dung phong phú (content blocks): src là đường dẫn, type là mã, day là số
    "src",
    "type",
    "day",
    # Mảng ảnh (gallery) — đường dẫn /content/vi/images/... không dịch
    "gallery",
    # Danh sách slug tour hot (máy, không dịch)
    "hot_tours",
}
# Keys (by suffix) that must never be translated (machine-readable data).
SKIP_KEY_SUFFIX = (
    "_slug", "_image", "_price", "_hotline", "_phone", "_email",
    "_website", "_zalo", "_region",
)
# If a value contains only these characters (digits, punctuation, currency
# symbols, whitespace) it is treated as non-translatable.
NON_TEXT_RE = re.compile(r"^[\d\s.,:;%đ/()\-–+]+$", re.UNICODE)
# Email / URL / số điện thoại (dãy số dài) / HTML entity — được đặt placeholder để khỏi bị dịch hỏng.
PROTECT_RE = re.compile(
    r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"
    r"|https?://[^\s\"'<>]+"
    r"|\bwww\.[^\s\"'<>]+"
    r"|(?:\d[\s.-]?){8,}"
    r"|&(?:[a-zA-Z]+|#\d+);"          # HTML entity (&amp;, &#39;...)
)
# Inline HTML tag (bold/italic/link...) trong block text — placeholder hoá để Argos không dịch hỏng tag.
INLINE_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")


def should_translate(key: str, value: str) -> bool:
    if key in SKIP_KEY_EXACT or key.endswith(SKIP_KEY_SUFFIX):
        return False
    if not isinstance(value, str) or not value.strip():
        return False
    if NON_TEXT_RE.match(value.strip()):
        return False
    return True


# Khối HTML đầy đủ (body_html của trang) — tách thẻ/tag khỏi text, chỉ dịch phần
# text (giữ nguyên cấu trúc HTML + inline style/attr). Đây là nền tảng để admin
# soạn 1 khối nội dung phong phú bằng SunEditor và tự động có bản EN.
HTML_SPLIT_RE = re.compile(r"(</?[a-zA-Z][^>]*>)")

# Danh từ riêng / thương hiệu phải GIỮ NGUYÊN khi dịch body_html (không để Argos bẻ hỏng).
PROPER_NOUNS = [
    "CÔNG TY DU LỊCH TODAYTOURIST",
    "TODAYTOURIST",
]


def translate_html(translator, html: str) -> str:
    if not isinstance(html, str) or not html.strip():
        return html
    if translator is None or getattr(translator, "available", False) is False:
        return html
    # Che danh từ riêng bằng placeholder trước khi dịch (giống email/URL/phone)
    tokens: list[str] = []

    def _protect_proper(match):
        tokens.append(match.group(0))
        return f"QQ{len(tokens) - 1}QQ"

    protected = html
    for noun in PROPER_NOUNS:
        protected = re.sub(re.escape(noun), _protect_proper, protected, flags=re.IGNORECASE)
    parts = HTML_SPLIT_RE.split(protected)
    out = []
    for part in parts:
        if HTML_SPLIT_RE.fullmatch(part):
            out.append(part)  # giữ nguyên thẻ/tag (kèm inline style)
        elif part.strip():
            out.append(translator.translate(part))
        else:
            out.append(part)
    result = "".join(out)
    for i, tok in enumerate(tokens):
        result = result.replace(f"QQ{i}QQ", tok)
    return result


class Translator:
    """Thin wrapper around argostranslate (loaded lazily)."""

    def __init__(self, source: str, target: str):
        self.source = source
        self.target = target
        self._fn = None
        try:
            from argostranslate import translate as _atranslate
            model = _atranslate.get_translation_from_codes(source, target)
            if model is not None:
                self._fn = model.translate
        except Exception:
            self._fn = None

    @property
    def available(self) -> bool:
        return self._fn is not None

    def translate(self, text: str) -> str:
        if self._fn is None:
            return text
        try:
            # Translate pipe-separated lists segment by segment.
            if "|" in text:
                parts = [p.strip() for p in text.split("|")]
                return "|".join(self.translate(p) for p in parts if p)
            # Bảo vệ email/URL/số điện thoại/entity/INLINE TAG khỏi bị dịch hỏng:
            # thay bằng placeholder QQ{n}QQ (chữ hoa+số — sống sót qua Argos), dịch rồi khôi phục.
            tokens: list[str] = []

            def _protect(match: "re.Match[str]") -> str:
                tokens.append(match.group(0))
                return f"QQ{len(tokens) - 1}QQ"

            protected = INLINE_TAG_RE.sub(_protect, text)  # tag trước (có thể chứa url/entity)
            protected = PROTECT_RE.sub(_protect, protected)
            out = self._fn(protected)
            out = out if isinstance(out, str) and out.strip() else protected
            for i, tok in enumerate(tokens):
                out = out.replace(f"QQ{i}QQ", tok)
            return out
        except Exception:
            return text


def load_overrides(overrides_path):
    """Load the curated QA layer: {key: english_text}."""
    if not overrides_path.is_file():
        return {}
    try:
        return json.loads(overrides_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def apply_override(overrides, file_key: str, key: str, value):
    """Return the curated English value if an override exists.

    Lookup order: "<file>/<key>" (unambiguous) then "<key>" (fallback).
    """
    if f"{file_key}/{key}" in overrides:
        return overrides[f"{file_key}/{key}"]
    if key in overrides:
        return overrides[key]
    return value


def walk(obj, key, translator, overrides, file_key):
    # Mảng cấu hình khối trang chủ (id/type/enabled) — dữ liệu máy, KHÔNG dịch.
    if key == "home_blocks":
        return obj
    if isinstance(obj, dict):
        return {
            k: walk(v, k, translator, overrides, file_key)
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [walk(v, key, translator, overrides, file_key) for v in obj]
    if isinstance(obj, str):
        # body_html + mọi khối HTML (block_*, footer_*_body): dịch text, giữ tag/style
        if key == "body_html" or re.search(r"<[a-zA-Z][^>]*>", obj):
            translated = translate_html(translator, obj)
        elif should_translate(key, obj):
            translated = translator.translate(obj)
        else:
            translated = obj
        return apply_override(overrides, file_key, key, translated)
    return obj


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="vi")
    parser.add_argument("--target", default="en")
    parser.add_argument("--lang-dir", default="content")
    parser.add_argument("--force", action="store_true",
                        help="translate even if target already exists")
    args = parser.parse_args()

    root = Path(args.lang_dir)
    src_dir = root / args.source
    out_dir = root / args.target
    overrides = load_overrides(root / f"overrides.{args.target}.json")
    if not src_dir.is_dir():
        print(f"[translate] ERROR: source dir not found: {src_dir}", file=sys.stderr)
        return 2

    out_dir.mkdir(parents=True, exist_ok=True)
    translator = Translator(args.source, args.target)
    if translator.available:
        print(f"[translate] Argos Translate ready: {args.source} -> {args.target}")
    else:
        print("[translate] WARNING: Argos Translate not available "
              f"({args.source}->{args.target}). Falling back.")
    print(f"[translate] QA overrides loaded: {len(overrides)} key(s)")

    # Đệ quy (rglob) để dịch cả file trong thư mục con (tours/, news/).
    files = sorted(src_dir.rglob("*.json"))
    if not files:
        print(f"[translate] No JSON files found in {src_dir}")
        return 2

    for src_file in files:
        rel = src_file.relative_to(src_dir)
        file_key = rel.with_suffix("").as_posix()  # vd: "tours/tour-x" hoặc "tours"
        out_file = out_dir / rel
        if out_file.exists() and file_key in MANUAL_EN:
            print(f"[translate] keep manual EN {rel.as_posix()}")
            continue
        # DỊCH CHỌN LỌC: bản EN đã có và mới hơn (hoặc bằng) bản VI -> không dịch lại.
        # Chỉ dịch những file VI thay đổi / bản EN còn thiếu (trừ khi --force).
        if out_file.exists() and not args.force:
            try:
                if out_file.stat().st_mtime >= src_file.stat().st_mtime:
                    print(f"[translate] skip (en up-to-date) {rel.as_posix()}")
                    continue
            except Exception:
                pass
        if out_file.exists() and not args.force and not translator.available:
            print(f"[translate] keep existing {rel.as_posix()}")
            continue
        try:
            data = json.loads(src_file.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[translate] ERROR reading {src_file}: {exc}", file=sys.stderr)
            return 2
        translated = walk(data, "", translator, overrides, file_key)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(
            json.dumps(translated, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"[translate] {rel.as_posix()} -> {out_dir.name}/{rel.as_posix()}")

    if not translator.available:
        print("[translate] NOTE: ran in fallback mode. Run "
              "'npm run translate:setup' to enable real translation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
