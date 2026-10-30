# -*- coding: utf-8 -*-
"""生成 PWA 图标（192 / 512 PNG）。用法：python tools/make_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "public" / "icons"


def make(size: int) -> Image.Image:
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(s * 0.22)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=(59, 111, 212, 255))

    font = None
    for name in ("msyhbd.ttc", "msyh.ttc", "simhei.ttf"):
        p = Path("C:/Windows/Fonts") / name
        if p.exists():
            font = ImageFont.truetype(str(p), int(s * 0.56))
            break
    if font is None:
        raise SystemExit("找不到中文字体")

    text = "行"
    box = d.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(((s - tw) / 2 - box[0], (s - th) / 2 - box[1]), text, font=font, fill=(255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        path = OUT / f"icon-{size}.png"
        make(size).save(path, "PNG")
        print("wrote", path)


if __name__ == "__main__":
    main()
