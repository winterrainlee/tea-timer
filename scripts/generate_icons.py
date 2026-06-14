from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        for x in range(size):
            px[x, y] = (
                lerp(top[0], bottom[0], t),
                lerp(top[1], bottom[1], t),
                lerp(top[2], bottom[2], t),
                255,
            )
    return img


def add_radial_glow(base: Image.Image, center: tuple[float, float], radius: float, color: tuple[int, int, int, int]) -> None:
    size = base.size[0]
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    px = layer.load()
    cx, cy = center
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / radius
            if d < 1:
                a = round(color[3] * (1 - d) ** 2)
                px[x, y] = (color[0], color[1], color[2], a)
    base.alpha_composite(layer)


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    scale = size / 1024
    img = vertical_gradient(size, (44, 35, 21), (18, 13, 9))
    add_radial_glow(img, (size * 0.5, size * 0.45), size * 0.62, (205, 191, 99, 92))
    add_radial_glow(img, (size * 0.5, size * 0.62), size * 0.48, (228, 214, 145, 62))

    d = ImageDraw.Draw(img, "RGBA")
    gold = (205, 191, 99, 255)
    gold_soft = (228, 214, 145, 255)
    cream = (246, 236, 204, 255)
    cream_shadow = (170, 143, 88, 175)
    tea = (197, 177, 83, 210)
    line = (88, 76, 45, 135)

    margin = 178 * scale if maskable else 118 * scale
    ring_box = [margin, margin, size - margin, size - margin]
    d.arc(ring_box, start=215, end=508, fill=(*gold_soft[:3], 172), width=max(8, round(22 * scale)))
    d.arc(ring_box, start=30, end=130, fill=(*gold[:3], 70), width=max(5, round(14 * scale)))

    # Steam strokes.
    for i, xmul in enumerate((0.42, 0.5, 0.58)):
        x = size * xmul
        y0 = size * (0.29 - i * 0.015)
        pts = []
        for n in range(34):
            t = n / 33
            pts.append((x + math.sin(t * math.pi * 2.1 + i) * size * 0.025, y0 - t * size * 0.13))
        d.line(pts, fill=(246, 236, 204, 96), width=max(3, round(8 * scale)), joint="curve")

    # Saucer shadow and saucer.
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    sd.ellipse(
        [size * 0.23, size * 0.67, size * 0.77, size * 0.81],
        fill=(0, 0, 0, 85),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, round(18 * scale))))
    img.alpha_composite(shadow)

    d.ellipse([size * 0.22, size * 0.64, size * 0.78, size * 0.77], fill=(232, 218, 175, 235), outline=cream_shadow, width=max(2, round(5 * scale)))
    d.ellipse([size * 0.30, size * 0.655, size * 0.70, size * 0.735], fill=(255, 247, 221, 120))

    # Cup body.
    cup = [
        (size * 0.30, size * 0.47),
        (size * 0.70, size * 0.47),
        (size * 0.65, size * 0.68),
        (size * 0.35, size * 0.68),
    ]
    d.polygon(cup, fill=(240, 226, 188, 246))
    d.line(cup + [cup[0]], fill=cream_shadow, width=max(3, round(8 * scale)))
    d.ellipse([size * 0.30, size * 0.43, size * 0.70, size * 0.52], fill=cream, outline=cream_shadow, width=max(3, round(8 * scale)))
    d.ellipse([size * 0.36, size * 0.465, size * 0.64, size * 0.505], fill=tea)
    d.ellipse([size * 0.39, size * 0.472, size * 0.61, size * 0.493], fill=(241, 230, 143, 92))

    # Handle and timer dot.
    d.arc([size * 0.61, size * 0.49, size * 0.83, size * 0.68], start=282, end=80, fill=cream, width=max(9, round(22 * scale)))
    d.arc([size * 0.635, size * 0.525, size * 0.785, size * 0.65], start=284, end=78, fill=line, width=max(3, round(7 * scale)))
    d.ellipse([size * 0.47, size * 0.175, size * 0.53, size * 0.235], fill=gold_soft)

    # Soft highlight.
    d.arc([size * 0.34, size * 0.48, size * 0.66, size * 0.66], start=195, end=340, fill=(255, 255, 236, 80), width=max(2, round(5 * scale)))
    return img


def main() -> None:
    OUT.mkdir(exist_ok=True)
    base = draw_icon(1024)
    maskable = draw_icon(1024, maskable=True)
    for name, img, size in [
        ("icon-192.png", base, 192),
        ("icon-512.png", base, 512),
        ("apple-touch-icon.png", base, 180),
        ("icon-maskable.png", maskable, 512),
    ]:
        img.resize((size, size), Image.Resampling.LANCZOS).save(OUT / name)


if __name__ == "__main__":
    main()
