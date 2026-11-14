"""Draws the Android status-bar icon for reminders: a white poke bowl on transparent, at every density.

Android shows small notification icons as a single-colour silhouette, so only the shape matters.
"""
from pathlib import Path
from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / 'android' / 'app' / 'src' / 'main' / 'res'
SIZES = {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96}
WHITE = (255, 255, 255, 255)


def bowl(size):
    # Drawn on a 24-unit grid, then scaled with crisp pixels.
    im = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([5, 4, 19, 13], fill=WHITE)  # Rice and toppings piled up.
    d.polygon([(2, 11), (22, 11), (18, 19), (6, 19)], fill=WHITE)  # The bowl.
    d.rectangle([8, 19, 16, 20], fill=WHITE)  # Its foot.
    d.rectangle([2, 11, 22, 12], fill=(0, 0, 0, 0))  # A gap that separates rim from rice.
    d.line([3, 13, 21, 13], fill=WHITE)
    return im.resize((size, size), Image.NEAREST)


if __name__ == '__main__':
    for density, size in SIZES.items():
        folder = RES / f'drawable-{density}'
        folder.mkdir(parents=True, exist_ok=True)
        bowl(size).save(folder / 'ic_stat_sbuffo.png')
