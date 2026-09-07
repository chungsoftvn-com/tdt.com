#!/usr/bin/env python3
"""
Ensure the Argos Translate vi -> en package is installed.

Usage: python scripts/setup-argos.py

Used both locally and in GitHub Actions so that `npm run build` can
always produce a real machine translation of the Vietnamese content.
"""

import subprocess
import sys


def install_pip_package():
    try:
        import argostranslate  # noqa: F401
        print("[argos] argostranslate already installed.")
        return
    except ImportError:
        pass
    print("[argos] Installing argostranslate via pip ...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "argostranslate", "--quiet"]
    )


def ensure_language_package(src="vi", dst="en"):
    from argostranslate import package

    installed = package.get_installed_packages()
    if any(p.from_code == src and p.to_code == dst for p in installed):
        print(f"[argos] Language package {src}->{dst} already installed.")
        return

    print("[argos] Updating package index ...")
    package.update_package_index()
    available = package.get_available_packages()
    match = next(
        (p for p in available if p.from_code == src and p.to_code == dst), None
    )
    if match is None:
        print(f"[argos] ERROR: no available package {src}->{dst}", file=sys.stderr)
        sys.exit(1)

    print(f"[argos] Downloading & installing {src}->{dst} ...")
    path = match.download()
    package.install_from_path(path)
    print(f"[argos] Installed {src}->{dst} from {path}")


def main():
    install_pip_package()
    ensure_language_package()


if __name__ == "__main__":
    main()
