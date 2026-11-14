"""Draws each skin from behind, looking down the road, for the Wipe-Uff kart (www/sprites/wipeuff/back_<skin>.png).

Only the head and shoulders show: the rest is hidden inside the poke bowl.
"""
from pathlib import Path
from make_veggies import canvas, blob, outlined

OUT = Path(__file__).resolve().parent.parent / 'www' / 'sprites' / 'wipeuff'
SKIN, SKIN_S = (240, 190, 154, 255), (214, 154, 120, 255)


def sbuffling():
    """Big black curls from behind, a teal blouse and the pink tips of her glasses."""
    im, d = canvas(30, 28)
    TOP, TOP_D = (24, 92, 84, 255), (14, 64, 62, 255)
    HAIR, HAIR_L = (28, 24, 34, 255), (66, 58, 78, 255)
    d.rectangle([4, 20, 25, 27], fill=TOP)  # shoulders
    d.rectangle([4, 26, 25, 27], fill=TOP_D)
    d.rectangle([2, 22, 5, 27], fill=TOP)  # arms on the rim
    d.rectangle([24, 22, 27, 27], fill=TOP)
    d.rectangle([13, 18, 16, 20], fill=SKIN_S)  # neck
    for x, y, r in [(15, 10, 9), (8, 8, 5), (22, 8, 5), (7, 14, 5), (23, 14, 5), (10, 4, 4), (20, 4, 4), (15, 3, 5), (11, 17, 4), (19, 17, 4)]:
        blob(d, x, y, r, r, HAIR)
    for x, y in [(9, 6), (14, 4), (19, 7), (8, 13), (22, 12), (12, 10), (17, 12), (15, 16)]:
        d.point([(x, y + 1), (x + 1, y), (x + 2, y + 1)], fill=HAIR_L)
    d.point([(1, 10), (28, 10)], fill=(222, 158, 172, 255))  # glasses peeking out
    d.point([(1, 11), (28, 11)], fill=SKIN)
    return outlined(im)


def boxer():
    """Spiky silver hair from behind, ears, and the grey hood of the tracksuit."""
    im, d = canvas(30, 28)
    SUIT, SUIT_D, SUIT_L = (150, 150, 158, 255), (112, 112, 122, 255), (176, 176, 184, 255)
    HAIR, HAIR_L, HAIR_D = (214, 214, 220, 255), (248, 248, 252, 255), (160, 160, 172, 255)
    d.rectangle([4, 20, 25, 27], fill=SUIT)
    d.rectangle([2, 22, 5, 27], fill=SUIT)
    d.rectangle([24, 22, 27, 27], fill=SUIT)
    blob(d, 15, 21, 7, 3, SUIT_D)  # the hood lying on his back
    d.rectangle([12, 21, 18, 22], fill=SUIT_L)
    d.rectangle([11, 16, 18, 19], fill=SKIN)  # neck
    d.rectangle([7, 4, 22, 17], fill=SKIN)  # back of the head
    d.rectangle([6, 9, 6, 13], fill=SKIN_S)  # ears
    d.rectangle([23, 9, 23, 13], fill=SKIN_S)
    d.rectangle([7, 4, 22, 14], fill=HAIR)  # short crop, spikes on top
    heights = [1, 2, 3, 2, 4, 3, 5, 4, 5, 3, 4, 2, 3, 2, 1, 1]
    for x, h in zip(range(7, 23), heights):
        d.rectangle([x, 4 - h, x, 4], fill=HAIR)
        if h >= 3:
            d.point((x, 4 - h), HAIR_L)
    for x in range(8, 22, 3):
        d.line([x, 7, x + 1, 12], fill=HAIR_D)
    d.rectangle([8, 14, 21, 15], fill=HAIR_D)  # faded neckline
    return outlined(im)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    sbuffling().save(OUT / 'back_default.png')
    boxer().save(OUT / 'back_boxer.png')
