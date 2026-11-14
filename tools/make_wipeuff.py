"""Draws the Wipe-Uff race art into www/sprites/wipeuff/: the poke-bowl kart, garden scenery and items."""
from pathlib import Path
from make_veggies import canvas, blob, outlined

OUT = Path(__file__).resolve().parent.parent / 'www' / 'sprites' / 'wipeuff'
BOWL, BOWL_L, BOWL_D = (46, 76, 120, 255), (112, 150, 196, 255), (30, 50, 84, 255)
RICE, SALMON, AVO = (250, 246, 232, 255), (244, 128, 104, 255), (150, 196, 84, 255)
TYRE, HUB = (34, 30, 40, 255), (120, 116, 130, 255)
GREEN, GREEN_D, GREEN_L = (78, 160, 70, 255), (48, 112, 52, 255), (132, 204, 104, 255)
RED, RED_D = (226, 74, 62, 255), (160, 40, 40, 255)
GOLD, GOLD_D, GOLD_L = (255, 200, 60, 255), (200, 130, 30, 255), (255, 240, 160, 255)
WOOD, WOOD_D = (176, 120, 72, 255), (120, 78, 46, 255)
BROWN = (92, 60, 40, 255)


def kart():
    """The poke-bowl kart seen from behind; the driver is drawn sitting in it by the game."""
    im, d = canvas(40, 26)
    for x in (3, 31):  # back tyres
        d.rectangle([x, 15, x + 6, 24], fill=TYRE)
        d.rectangle([x + 2, 18, x + 4, 21], fill=HUB)
    blob(d, 20, 9, 15, 4, RICE)  # rice and toppings at the rim
    d.rectangle([9, 6, 13, 8], fill=SALMON)
    d.rectangle([25, 6, 29, 8], fill=AVO)
    d.polygon([(4, 10), (36, 10), (31, 22), (9, 22)], fill=BOWL)
    d.line([4, 10, 36, 10], fill=BOWL_L)
    d.line([6, 12, 34, 12], fill=BOWL_L)
    d.rectangle([14, 22, 26, 23], fill=BOWL_D)  # foot
    d.rectangle([13, 15, 17, 17], fill=(255, 220, 120, 255))  # rear lights
    d.rectangle([23, 15, 27, 17], fill=(255, 220, 120, 255))
    return outlined(im)


def cabbage():
    im, d = canvas(32, 28)
    blob(d, 16, 16, 14, 11, GREEN_D)
    blob(d, 16, 15, 11, 9, GREEN)
    blob(d, 16, 14, 6, 5, GREEN_L)
    for x in (9, 16, 23):
        d.line([16, 22, x, 8], fill=GREEN_D)
    return outlined(im)


def tomato_plant():
    im, d = canvas(24, 40)
    d.rectangle([11, 4, 12, 39], fill=WOOD)  # cane
    for y, side in ((10, -1), (17, 1), (24, -1), (31, 1)):
        blob(d, 12 + side * 5, y, 5, 3, GREEN)
    for x, y in ((6, 14), (17, 21), (7, 28), (16, 34), (12, 8)):
        blob(d, x, y, 3, 3, RED)
        d.point((x - 1, y - 1), (255, 170, 150, 255))
    return outlined(im)


def sunflower():
    im, d = canvas(26, 48)
    d.rectangle([12, 16, 13, 47], fill=GREEN_D)
    blob(d, 8, 30, 5, 2, GREEN)
    blob(d, 18, 37, 5, 2, GREEN)
    for i in range(12):
        import math
        a = i * math.pi / 6
        blob(d, 13 + round(math.cos(a) * 8), 12 + round(math.sin(a) * 8), 3, 3, GOLD)
    blob(d, 13, 12, 6, 6, BROWN)
    d.point([(11, 10), (14, 13), (12, 14), (15, 10)], fill=(140, 96, 56, 255))
    return outlined(im)


def carrot_patch():
    im, d = canvas(36, 22)
    d.rectangle([1, 14, 34, 21], fill=BROWN)
    for x in (6, 15, 24, 31):
        d.polygon([(x - 3, 15), (x + 3, 15), (x, 20)], fill=(240, 140, 50, 255))
        for dx in (-3, 0, 3):
            d.line([x, 14, x + dx, 4 + abs(dx)], fill=GREEN)
    return outlined(im)


def fence():
    im, d = canvas(48, 24)
    for x in (2, 15, 28, 41):
        d.rectangle([x, 2, x + 4, 23], fill=WOOD)
        d.polygon([(x, 2), (x + 4, 2), (x + 2, 0)], fill=WOOD)
    d.rectangle([0, 7, 47, 9], fill=WOOD_D)
    d.rectangle([0, 15, 47, 17], fill=WOOD_D)
    return outlined(im)


def item_box():
    """A floating golden crate with a question mark."""
    im, d = canvas(24, 24)
    d.rectangle([2, 2, 21, 21], fill=GOLD)
    d.rectangle([2, 2, 21, 4], fill=GOLD_L)
    d.rectangle([2, 19, 21, 21], fill=GOLD_D)
    for (x0, y0, x1, y1) in ((9, 6, 14, 7), (14, 7, 15, 10), (11, 11, 14, 12), (11, 13, 12, 14), (11, 16, 12, 17)):
        d.rectangle([x0, y0, x1, y1], fill=(120, 60, 20, 255))
    return outlined(im)


def wasabi():
    im, d = canvas(20, 20)
    blob(d, 10, 12, 7, 6, (126, 200, 70, 255))
    blob(d, 10, 7, 4, 3, (150, 220, 90, 255))
    d.point([(7, 10), (8, 9)], fill=(210, 250, 170, 255))
    return outlined(im)


def chili():
    im, d = canvas(24, 20)
    d.polygon([(3, 8), (16, 5), (21, 9), (14, 13), (4, 12)], fill=RED)
    d.line([5, 8, 14, 6], fill=(255, 150, 130, 255))
    d.rectangle([18, 4, 22, 7], fill=GREEN)
    return outlined(im)


def soy():
    """A soy-sauce slick left on the track."""
    im, d = canvas(32, 14)
    blob(d, 16, 7, 14, 5, (60, 30, 20, 255))
    blob(d, 12, 6, 6, 2, (110, 64, 40, 255))
    return im


def soy_bottle():
    im, d = canvas(16, 24)
    d.rectangle([4, 9, 11, 22], fill=(60, 30, 20, 255))
    d.rectangle([6, 3, 9, 8], fill=(60, 30, 20, 255))
    d.rectangle([5, 0, 10, 3], fill=RED)
    d.rectangle([5, 13, 10, 17], fill=RICE)
    return outlined(im)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, draw in {
        'kart': kart, 'cabbage': cabbage, 'tomato': tomato_plant, 'sunflower': sunflower,
        'carrots': carrot_patch, 'fence': fence, 'box': item_box, 'wasabi': wasabi, 'chili': chili,
        'soy': soy, 'soybottle': soy_bottle,
    }.items():
        draw().save(OUT / f'{name}.png')
