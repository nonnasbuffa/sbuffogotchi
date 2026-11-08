"""Draws the vegetable bosses and the rice-game art into www/sprites."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

OUT = Path(__file__).resolve().parent.parent / 'www' / 'sprites'
LINE = (27, 21, 37, 255)
WHITE = (246, 238, 221, 255)
BOSS_SIZE = 36


def canvas(w=BOSS_SIZE, h=BOSS_SIZE):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def blob(d, cx, cy, rx, ry, col):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=col)


def outlined(im):
    """Adds a one-pixel dark line around everything drawn."""
    out = im.copy()
    px, w, h = im.load(), im.width, im.height
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                continue
            near = ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            if any(0 <= a < w and 0 <= b < h and px[a, b][3] for a, b in near):
                out.putpixel((x, y), LINE)
    return out


def face(d, cx, cy, gap=3):
    """Angry eyes and a toothy scowl, centred on cx."""
    for side in (-1, 1):
        left = cx - gap - 3 if side < 0 else cx + gap
        d.rectangle([left, cy, left + 2, cy + 2], fill=WHITE)
        pupil = left + 1 if side < 0 else left + 1
        d.rectangle([pupil, cy + 1, pupil, cy + 2], fill=LINE)
        # The brow slopes down toward the nose.
        for i in range(4):
            x = left - 1 + i if side < 0 else left + 3 - i
            d.point((x, cy - 2 + i // 2), fill=LINE)
    d.rectangle([cx - 3, cy + 5, cx + 2, cy + 6], fill=LINE)
    d.point((cx - 2, cy + 5), fill=WHITE)
    d.point((cx + 1, cy + 5), fill=WHITE)


def broccoli():
    im, d = canvas()
    dark, mid, light = (38, 105, 52, 255), (58, 142, 62, 255), (108, 186, 82, 255)
    d.rectangle([11, 18, 24, 33], fill=(176, 210, 112, 255))
    d.rectangle([21, 19, 24, 33], fill=(135, 176, 84, 255))
    d.rectangle([11, 32, 24, 33], fill=(135, 176, 84, 255))
    tops = [(7, 13, 6), (18, 7, 7), (28, 13, 6), (12, 8, 5), (24, 8, 5), (18, 14, 8), (11, 17, 4), (25, 17, 4)]
    for x, y, r in tops:
        blob(d, x, y, r, r, dark)
    for x, y, r in tops:
        blob(d, x - 1, y - 1, r - 1, r - 1, mid)
    for x, y in [(5, 11), (9, 15), (15, 5), (21, 6), (26, 11), (30, 15), (13, 12), (19, 12), (24, 16), (16, 17)]:
        blob(d, x, y, 1, 1, light)
    for x, y in [(8, 11), (18, 9), (22, 13), (28, 12), (12, 15), (15, 9), (26, 7)]:
        d.point((x, y), fill=dark)
    face(d, 17, 25)
    return outlined(im)


def sprout():
    im, d = canvas()
    dark, mid, light = (73, 124, 44, 255), (118, 170, 62, 255), (164, 207, 92, 255)
    blob(d, 18, 19, 15, 15, dark)
    blob(d, 17, 18, 13, 13, mid)
    blob(d, 13, 12, 6, 4, light)
    # Layered leaves wrapping around the head.
    d.arc([3, 5, 25, 33], 200, 330, fill=dark)
    d.arc([11, 3, 33, 31], 210, 340, fill=dark)
    d.arc([5, 15, 31, 41], 195, 345, fill=dark)
    d.line([18, 4, 18, 8], fill=dark)
    d.line([7, 26, 11, 31], fill=dark)
    d.line([29, 26, 25, 31], fill=dark)
    # The cut stub at the bottom.
    d.rectangle([14, 33, 21, 34], fill=(216, 222, 142, 255))
    face(d, 17, 17)
    return outlined(im)


def eggplant():
    im, d = canvas()
    dark, mid, light = (56, 26, 92, 255), (91, 44, 138, 255), (146, 96, 190, 255)
    blob(d, 18, 24, 12, 10, dark)
    blob(d, 18, 13, 8, 8, dark)
    blob(d, 17, 23, 11, 9, mid)
    blob(d, 17, 13, 7, 7, mid)
    d.line([9, 17, 8, 26], fill=light, width=2)
    d.line([11, 10, 10, 14], fill=light)
    # Green cap and stem.
    green, deep = (94, 158, 66, 255), (58, 112, 50, 255)
    d.rectangle([16, 1, 20, 5], fill=green)
    d.rectangle([19, 1, 20, 5], fill=deep)
    blob(d, 18, 7, 8, 2, green)
    for x in range(10, 27, 4):
        d.polygon([(x, 8), (x + 3, 8), (x + 1, 11)], fill=deep)
    face(d, 17, 19)
    return outlined(im)


def carrot():
    im, d = canvas()
    dark, mid, light = (196, 92, 22, 255), (240, 138, 36, 255), (255, 182, 92, 255)
    green, deep = (92, 170, 70, 255), (56, 120, 54, 255)
    for x, top, col in [(11, 2, deep), (25, 2, deep), (14, 0, green), (22, 0, green), (18, 0, green)]:
        d.polygon([(18, 10), (x - 2, top + 3), (x, top), (x + 2, top + 3)], fill=col)
    d.polygon([(7, 11), (29, 11), (20, 35), (16, 35)], fill=dark)
    d.polygon([(8, 11), (27, 11), (19, 34), (17, 34)], fill=mid)
    blob(d, 18, 11, 10, 3, mid)
    d.line([10, 11, 13, 21], fill=light, width=2)
    for x, y, w in [(21, 22, 4), (11, 25, 3), (20, 28, 3)]:
        d.line([x, y, x + w, y], fill=dark)
    face(d, 17, 13)
    return outlined(im)


def leaf():
    """A frilly salad leaf whose tip points right, toward the rice."""
    im, d = canvas(16, 16)
    dark, mid, light = (54, 130, 58, 255), (100, 182, 72, 255), (160, 220, 104, 255)
    for x, y, r in [(3, 8, 3), (5, 4, 3), (5, 12, 3), (9, 4, 3), (9, 12, 3), (12, 6, 2), (12, 10, 2), (13, 8, 2)]:
        blob(d, x, y, r, r, dark)
    for x, y, r in [(4, 8, 3), (6, 5, 2), (6, 11, 2), (9, 5, 2), (9, 11, 2), (12, 8, 2)]:
        blob(d, x, y, r, r, mid)
    d.line([1, 8, 13, 8], fill=light)
    for x in (4, 7, 10):
        d.line([x, 8, x + 2, 5], fill=light)
        d.line([x, 8, x + 2, 11], fill=light)
    return outlined(im)


def rice():
    im, d = canvas(8, 5)
    d.rounded_rectangle([1, 1, 6, 3], radius=1, fill=(255, 252, 240, 255))
    d.line([2, 3, 5, 3], fill=(214, 206, 188, 255))
    return outlined(im)


def poke_bowl():
    """Four frames side by side: full, half eaten, nearly gone, empty."""
    sheet = Image.new('RGBA', (20 * 4, 14), (0, 0, 0, 0))
    rice_white, rice_shade = (250, 246, 232, 255), (214, 206, 188, 255)
    salmon, avocado, edamame = (244, 128, 104, 255), (150, 196, 84, 255), (92, 170, 70, 255)
    for frame in range(4):
        im, d = canvas(20, 14)
        d.ellipse([3, 4, 16, 8], fill=(24, 34, 62, 255))
        if frame < 3:
            top = [1, 3, 5][frame]
            d.ellipse([3, top, 16, 10], fill=rice_white)
            d.line([4, 6, 15, 6], fill=rice_shade)
        if frame == 0:
            d.rectangle([5, 2, 8, 4], fill=salmon)
            d.rectangle([12, 3, 14, 5], fill=avocado)
            d.point([(10, 2), (10, 4), (11, 3)], fill=edamame)
        if frame == 1:
            d.rectangle([6, 4, 8, 5], fill=salmon)
            d.point([(12, 4), (13, 5)], fill=avocado)
        if frame == 2:
            d.point((9, 5), fill=salmon)
        d.polygon([(1, 7), (18, 7), (15, 12), (4, 12)], fill=(46, 76, 120, 255))
        d.line([1, 7, 18, 7], fill=(112, 150, 196, 255))
        d.line([4, 12, 15, 12], fill=(30, 50, 84, 255))
        sheet.alpha_composite(outlined(im), (frame * 20, 0))
    return sheet


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    art = {'boss_broccoli': broccoli(), 'boss_sprout': sprout(), 'boss_eggplant': eggplant(), 'boss_carrot': carrot()}
    for name, image in art.items():
        image.save(OUT / f'{name}.png')
    leaf_right = leaf()
    leaf_right.save(OUT / 'leaf_right.png')
    ImageOps.mirror(leaf_right).save(OUT / 'leaf_left.png')
    rice().save(OUT / 'rice.png')
    poke_bowl().save(OUT / 'poke_bowl.png')
