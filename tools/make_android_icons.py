# -*- coding: utf-8 -*-
"""生成 Android 启动图标（含自适应前景）。用法：python tools/make_android_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
BLUE = (59, 111, 212, 255)
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def font(size: int):
    for name in ("msyhbd.ttc", "msyh.ttc", "simhei.ttf"):
        p = Path("C:/Windows/Fonts") / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    raise SystemExit("找不到中文字体")


def draw_char(img, size, ratio, color):
    d = ImageDraw.Draw(img)
    f = font(int(size * ratio))
    box = d.textbbox((0, 0), "行", font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(((size - tw) / 2 - box[0], (size - th) / 2 - box[1]), "行", font=f, fill=color)


def rounded(size):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BLUE)
    draw_char(img, s, 0.56, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def circular(size):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse([0, 0, s - 1, s - 1], fill=BLUE)
    draw_char(img, s, 0.52, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def foreground(size):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw_char(img, s, 0.40, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def main():
    for density, size in LEGACY.items():
        out = RES / f"mipmap-{density}"
        out.mkdir(parents=True, exist_ok=True)
        rounded(size).save(out / "ic_launcher.png")
        circular(size).save(out / "ic_launcher_round.png")
    for density, size in FOREGROUND.items():
        out = RES / f"mipmap-{density}"
        foreground(size).save(out / "ic_launcher_foreground.png")
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#3B6FD4</color>\n</resources>\n',
        encoding="utf-8",
    )
    print("android icons updated")


if __name__ == "__main__":
    main()
