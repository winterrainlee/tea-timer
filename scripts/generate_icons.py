from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
ICON_SVG = OUT / "icon.svg"
MASKABLE_SVG = OUT / "icon-maskable.svg"


def render(svg: Path, output: Path, size: int) -> None:
    rsvg = shutil.which("rsvg-convert")
    if not rsvg:
        raise SystemExit("rsvg-convert is required to generate PNG icons.")

    subprocess.run(
        [
            rsvg,
            "--format",
            "png",
            "--width",
            str(size),
            "--height",
            str(size),
            "--output",
            str(output),
            str(svg),
        ],
        check=True,
    )


def main() -> None:
    OUT.mkdir(exist_ok=True)

    for name, source, size in [
        ("favicon-16.png", ICON_SVG, 16),
        ("favicon-32.png", ICON_SVG, 32),
        ("icon-192.png", ICON_SVG, 192),
        ("icon-512.png", ICON_SVG, 512),
        ("apple-touch-icon.png", ICON_SVG, 180),
        ("icon-maskable.png", MASKABLE_SVG, 512),
    ]:
        render(source, OUT / name, size)


if __name__ == "__main__":
    main()
