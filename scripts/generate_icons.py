from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
SOURCE = OUT / "icon-source.jpeg"


def render(output: Path, size: int) -> None:
    sips = shutil.which("sips")
    if not sips:
        raise SystemExit("sips is required to generate PNG icons.")

    subprocess.run(
        [
            sips,
            "-s",
            "format",
            "png",
            "-z",
            str(size),
            str(size),
            str(SOURCE),
            "--out",
            str(output),
        ],
        check=True,
    )


def main() -> None:
    OUT.mkdir(exist_ok=True)
    if not SOURCE.exists():
        raise SystemExit(f"Missing icon source: {SOURCE}")

    for name, size in [
        ("favicon-16.png", 16),
        ("favicon-32.png", 32),
        ("icon-192.png", 192),
        ("icon-512.png", 512),
        ("apple-touch-icon.png", 180),
        ("icon-maskable.png", 512),
    ]:
        render(OUT / name, size)


if __name__ == "__main__":
    main()
