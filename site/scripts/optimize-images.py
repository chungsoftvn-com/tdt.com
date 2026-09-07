#!/usr/bin/env python3
"""
Optimize source images into lightweight WebP files for the website.

Input : content/vi/images/*.{png,jpg,jpeg}
Output: public/content/vi/images/*.webp   (served at /content/vi/images/...)

Keeps the site fast (a typical 1MB+ PNG becomes a ~60-120KB WebP). Re-run
after adding new images:  python scripts/optimize-images.py
"""

import argparse
from pathlib import Path

from PIL import Image

DEFAULT_MAX_WIDTH = 1000
DEFAULT_QUALITY = 82
SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")


def optimize(src: Path, dst: Path, max_width: int, quality: int) -> bool:
    if not src.is_file():
        print(f"[img] SKIP (missing): {src}")
        return False
    im = Image.open(src)
    im = im.convert("RGB")
    if im.width > max_width:
        ratio = max_width / im.width
        im = im.resize((max_width, int(im.height * ratio)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=quality, method=6)
    print(f"[img] {src.name} -> {dst.name}  ({im.width}x{im.height})")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", default="content/vi/images")
    parser.add_argument("--dst", default="public/content/vi/images")
    parser.add_argument("--max-width", type=int, default=DEFAULT_MAX_WIDTH)
    parser.add_argument("--quality", type=int, default=DEFAULT_QUALITY)
    args = parser.parse_args()

    src_dir = Path(args.src)
    dst_dir = Path(args.dst)
    if not src_dir.is_dir():
        print(f"[img] ERROR: source dir not found: {src_dir}")
        return 2

    done = 0
    for src in sorted(src_dir.iterdir()):
        if src.suffix.lower() in SUFFIXES:
            dst = dst_dir / (src.stem + ".webp")
            if optimize(src, dst, args.max_width, args.quality):
                done += 1
    print(f"[img] Done: {done} image(s) optimized.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
