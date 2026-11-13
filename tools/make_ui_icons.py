"""Draws the home-screen icons and the golden poke bowl into www/sprites."""
from make_veggies import OUT, canvas, blob, outlined

GOLD, GOLD_DARK, GOLD_LIGHT = (255, 200, 60, 255), (200, 130, 30, 255), (255, 240, 160, 255)
RED, GREEN = (226, 74, 62, 255), (92, 170, 70, 255)
BLUE, BLUE_DARK = (98, 182, 232, 255), (58, 120, 180, 255)
INK = (27, 21, 37, 255)


def star():
    im, d = canvas(16, 16)
    d.polygon([(8, 1), (10, 6), (15, 6), (11, 9), (13, 14), (8, 11), (3, 14), (5, 9), (1, 6), (6, 6)], fill=GOLD)
    d.line([7, 4, 6, 7], fill=GOLD_LIGHT)
    return outlined(im)


def small_bowl():
    im, d = canvas(16, 16)
    blob(d, 8, 6, 6, 4, (250, 246, 232, 255))
    d.rectangle([4, 3, 6, 5], fill=(244, 128, 104, 255))
    d.rectangle([10, 4, 11, 5], fill=(150, 196, 84, 255))
    d.polygon([(1, 8), (14, 8), (12, 13), (3, 13)], fill=(46, 76, 120, 255))
    d.line([1, 8, 14, 8], fill=(112, 150, 196, 255))
    return outlined(im)


def apple():
    im, d = canvas(16, 16)
    blob(d, 8, 9, 6, 5, RED)
    d.point([(5, 7), (5, 8), (6, 6)], fill=(255, 170, 150, 255))
    d.line([8, 4, 9, 1], fill=(112, 76, 44, 255))
    d.rectangle([10, 2, 12, 3], fill=GREEN)
    return outlined(im)


def bolt():
    im, d = canvas(16, 16)
    d.polygon([(9, 1), (3, 9), (7, 9), (6, 14), (13, 6), (9, 6)], fill=GOLD)
    return outlined(im)


def smile():
    im, d = canvas(16, 16)
    blob(d, 8, 8, 6, 6, GOLD)
    d.point([(6, 6), (10, 6), (6, 5), (10, 5)], fill=INK)
    d.line([5, 10, 11, 10], fill=INK)
    d.point([(4, 9), (12, 9)], fill=INK)
    return outlined(im)


def moon():
    im, d = canvas(16, 16)
    blob(d, 8, 8, 6, 6, (240, 226, 150, 255))
    blob(d, 11, 6, 5, 5, (0, 0, 0, 0))
    return outlined(im)


def heart():
    im, d = canvas(16, 16)
    blob(d, 5, 6, 3, 3, RED)
    blob(d, 11, 6, 3, 3, RED)
    d.polygon([(2, 7), (14, 7), (8, 14)], fill=RED)
    d.point([(4, 5), (5, 4)], fill=(255, 190, 180, 255))
    return outlined(im)


def dumbbell():
    im, d = canvas(16, 16)
    d.rectangle([4, 7, 11, 8], fill=(190, 186, 200, 255))
    for x in (1, 11):
        d.rectangle([x, 4, x + 3, 11], fill=(90, 84, 110, 255))
        d.line([x, 4, x + 3, 4], fill=(150, 144, 170, 255))
    return outlined(im)


def trophy():
    im, d = canvas(16, 16)
    d.arc([1, 2, 7, 8], 90, 270, fill=GOLD_DARK)
    d.arc([8, 2, 14, 8], 270, 90, fill=GOLD_DARK)
    d.polygon([(4, 1), (11, 1), (10, 8), (5, 8)], fill=GOLD)
    d.line([5, 2, 5, 6], fill=GOLD_LIGHT)
    d.rectangle([7, 9, 8, 11], fill=GOLD_DARK)
    d.rectangle([4, 12, 11, 13], fill=GOLD_DARK)
    return outlined(im)


def shield():
    im, d = canvas(16, 16)
    d.polygon([(2, 2), (13, 2), (13, 8), (8, 14), (2, 8)], fill=BLUE)
    d.polygon([(8, 2), (13, 2), (13, 8), (8, 14)], fill=BLUE_DARK)
    d.line([4, 4, 4, 7], fill=(200, 232, 250, 255))
    return outlined(im)


def rice_grain():
    im, d = canvas(16, 16)
    d.rounded_rectangle([2, 5, 13, 10], radius=2, fill=(255, 252, 240, 255))
    d.line([4, 10, 11, 10], fill=(214, 206, 188, 255))
    return outlined(im)


def pizza():
    im, d = canvas(24, 24)
    blob(d, 12, 12, 11, 11, (196, 128, 64, 255))
    blob(d, 12, 12, 9, 9, (250, 208, 96, 255))
    for x, y in [(8, 8), (15, 7), (17, 13), (11, 14), (7, 15), (14, 18)]:
        blob(d, x, y, 2, 2, (206, 62, 48, 255))
        d.point((x - 1, y - 1), fill=(240, 120, 96, 255))
    for x, y in [(12, 5), (5, 11), (19, 9), (10, 19), (18, 17)]:
        d.point([(x, y), (x + 1, y)], fill=(70, 150, 66, 255))
    return outlined(im)


def salmon_piece():
    im, d = canvas(16, 16)
    d.rounded_rectangle([2, 4, 13, 11], radius=2, fill=(244, 128, 104, 255))
    for x in (5, 8, 11):
        d.line([x, 5, x - 2, 10], fill=(255, 206, 190, 255))
    return outlined(im)


def avocado():
    im, d = canvas(16, 16)
    blob(d, 8, 9, 5, 5, (70, 120, 54, 255))
    blob(d, 8, 5, 3, 3, (70, 120, 54, 255))
    blob(d, 8, 9, 4, 4, (190, 216, 110, 255))
    blob(d, 8, 5, 2, 2, (190, 216, 110, 255))
    blob(d, 8, 10, 2, 2, (112, 76, 44, 255))
    return outlined(im)


def shrimp():
    im, d = canvas(16, 16)
    d.arc([2, 2, 13, 13], 200, 70, fill=(244, 150, 110, 255), width=4)
    d.point([(11, 8), (9, 11), (5, 12)], fill=(255, 220, 200, 255))
    d.point((4, 5), fill=INK)
    return outlined(im)


def edamame():
    im, d = canvas(16, 16)
    d.rounded_rectangle([1, 5, 14, 10], radius=2, fill=GREEN)
    for x in (4, 8, 12):
        blob(d, x, 7, 1, 1, (150, 214, 110, 255))
    return outlined(im)


def popsicle():
    im, d = canvas(16, 16)
    d.rectangle([7, 11, 8, 14], fill=(214, 170, 110, 255))
    d.rounded_rectangle([4, 1, 11, 11], radius=3, fill=(244, 110, 150, 255))
    d.rectangle([4, 6, 11, 8], fill=(255, 190, 90, 255))
    d.line([5, 3, 5, 9], fill=(255, 210, 225, 255))
    return outlined(im)


def phone():
    im, d = canvas(16, 16)
    d.rounded_rectangle([4, 1, 11, 14], radius=1, fill=(60, 56, 76, 255))
    d.rectangle([5, 3, 10, 11], fill=BLUE)
    d.line([5, 4, 7, 4], fill=(200, 232, 250, 255))
    d.rectangle([6, 7, 9, 9], fill=GOLD)
    d.point((8, 13), fill=(190, 186, 200, 255))
    return outlined(im)


def energy_can():
    """A plain energy-drink can with a lightning stripe."""
    im, d = canvas(16, 16)
    d.rectangle([4, 2, 11, 14], fill=(30, 34, 36, 255))
    d.rectangle([5, 1, 10, 2], fill=(170, 176, 186, 255))
    d.rectangle([5, 14, 10, 14], fill=(170, 176, 186, 255))
    d.line([9, 4, 6, 8, 9, 8, 6, 12], fill=(120, 240, 90, 255))
    d.line([4, 3, 4, 13], fill=(70, 76, 80, 255))
    return outlined(im)


def gear():
    im, d = canvas(16, 16)
    grey = (190, 186, 200, 255)
    for x, y in [(8, 2), (8, 13), (2, 8), (13, 8), (4, 4), (12, 4), (4, 12), (12, 12)]:
        d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=grey)
    blob(d, 8, 8, 5, 5, grey)
    blob(d, 8, 8, 2, 2, (35, 29, 51, 255))
    return outlined(im)


def backpack():
    im, d = canvas(16, 16)
    d.arc([5, 0, 10, 6], 180, 360, fill=(112, 76, 44, 255))
    d.rounded_rectangle([3, 3, 12, 14], radius=2, fill=(176, 112, 62, 255))
    d.rounded_rectangle([5, 8, 10, 13], radius=1, fill=(140, 86, 46, 255))
    d.line([3, 6, 12, 6], fill=(112, 76, 44, 255))
    d.point((8, 6), fill=GOLD)
    return outlined(im)


def friends():
    im, d = canvas(16, 16)
    back, front = (98, 182, 232, 255), (92, 170, 70, 255)
    blob(d, 11, 5, 3, 3, back)
    d.rounded_rectangle([7, 9, 15, 15], radius=3, fill=back)
    blob(d, 5, 6, 3, 3, front)
    d.rounded_rectangle([1, 10, 10, 15], radius=3, fill=front)
    return outlined(im)


def diamond_bowl():
    im, d = canvas(16, 16)
    ice, sky, deep, glint = (214, 244, 255, 255), (120, 210, 245, 255), (60, 140, 215, 255), (255, 255, 255, 255)
    d.polygon([(5, 2), (10, 2), (13, 5), (8, 9), (2, 5)], fill=ice)
    d.polygon([(8, 2), (10, 2), (13, 5), (8, 9)], fill=sky)
    d.line([2, 5, 13, 5], fill=deep)
    d.point([(5, 3), (6, 3)], fill=glint)
    d.polygon([(1, 8), (14, 8), (12, 13), (3, 13)], fill=sky)
    d.polygon([(8, 8), (14, 8), (12, 13), (8, 13)], fill=deep)
    d.line([1, 8, 14, 8], fill=glint)
    return outlined(im)


def golden_bowl():
    im, d = canvas(20, 14)
    d.ellipse([3, 1, 16, 10], fill=GOLD_LIGHT)
    d.rectangle([5, 2, 8, 4], fill=GOLD)
    d.rectangle([12, 3, 14, 5], fill=GOLD_DARK)
    d.point([(10, 2), (10, 4), (11, 3)], fill=GOLD_DARK)
    d.polygon([(1, 7), (18, 7), (15, 12), (4, 12)], fill=GOLD)
    d.line([1, 7, 18, 7], fill=GOLD_LIGHT)
    d.line([4, 12, 15, 12], fill=GOLD_DARK)
    d.point([(5, 9), (8, 10)], fill=GOLD_LIGHT)
    return outlined(im)


if __name__ == '__main__':
    icons = OUT / 'icons'
    icons.mkdir(parents=True, exist_ok=True)
    for name, draw in {
        'star': star, 'bowl': small_bowl, 'apple': apple, 'bolt': bolt, 'smile': smile, 'moon': moon,
        'heart': heart, 'dumbbell': dumbbell, 'trophy': trophy, 'shield': shield, 'rice': rice_grain,
        'salmon': salmon_piece, 'avocado': avocado, 'shrimp': shrimp, 'edamame': edamame,
        'diamond': diamond_bowl, 'popsicle': popsicle, 'phone': phone, 'monster': energy_can, 'gear': gear, 'backpack': backpack, 'friends': friends,
    }.items():
        draw().save(icons / f'{name}.png')
    golden_bowl().save(OUT / 'golden_bowl.png')
    pizza().save(OUT / 'pizza.png')
