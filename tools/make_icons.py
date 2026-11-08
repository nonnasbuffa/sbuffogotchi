"""Paints the app icon and splash from the idle sprite over every Capacitor default image."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BG = (35, 29, 51, 255)
sprite = Image.open(ROOT / "www/sprites/idle_sheet.png").convert("RGBA").crop((0, 0, 44, 54))
sprite = sprite.crop(sprite.getbbox())


def art(size, fill, background):
    """The sprite scaled by a whole number so its pixels stay crisp."""
    canvas = Image.new("RGBA", (size, size), background)
    k = max(1, int(size * fill / max(sprite.size)))
    big = sprite.resize((sprite.width * k, sprite.height * k), Image.NEAREST)
    canvas.alpha_composite(big, ((size - big.width) // 2, (size - big.height) // 2))
    return canvas


for png in (ROOT / "android/app/src/main/res").rglob("*.png"):
    with Image.open(png) as old:
        w, h = old.size
    if "foreground" in png.name:
        out = art(w, 0.55, (0, 0, 0, 0))
    elif png.parent.name.startswith("mipmap"):
        out = art(w, 0.8, BG)
    else:  # splash, in any orientation
        square = art(min(w, h), 0.35, BG)
        out = Image.new("RGBA", (w, h), BG)
        out.alpha_composite(square, ((w - square.width) // 2, (h - square.height) // 2))
    out.save(png)

for png in (ROOT / "ios/App/App/Assets.xcassets").rglob("*.png"):
    with Image.open(png) as old:
        w, h = old.size
    if w == h and w <= 1024:
        out = art(w, 0.8, BG)
    else:
        square = art(min(w, h), 0.35, BG)
        out = Image.new("RGBA", (w, h), BG)
        out.alpha_composite(square, ((w - square.width) // 2, (h - square.height) // 2))
    out.convert("RGB").save(png)  # iOS icons must not have transparency

for values in (ROOT / "android/app/src/main/res").rglob("ic_launcher_background.xml"):
    values.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#231D33</color>\n</resources>\n', encoding="utf-8")
print("icons done")
