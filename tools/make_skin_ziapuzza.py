"""Draws the "Zia Puzza" shop skin: short wavy blonde hair swept to one side, dark rectangular glasses,
pink lips and a turquoise shirt with pink stars, in the pet's 44x54 frames.

Same animations, frame counts and timings as make_sprites.py, so the game can swap sheets freely.
Writes www/sprites/skins/ziapuzza/{idle,happy,sad,battle}_sheet.png and icon.png.
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw
from make_skin_boxer import W, H, CX, OUTLINE, rect, outline, with_shadow, ANIMS

OUT = Path(__file__).resolve().parent.parent / 'www' / 'sprites' / 'skins' / 'ziapuzza'
SKIN, SKIN_S, SKIN_D = (240, 196, 168, 255), (218, 162, 132, 255), (172, 116, 96, 255)
HAIR, HAIR_L, HAIR_D = (206, 170, 112, 255), (240, 214, 160, 255), (150, 116, 70, 255)
FRAME = (40, 40, 52, 255)
LENS = (196, 222, 236, 255)
EYE = (60, 70, 86, 255)
LIPS, LIPS_D = (222, 140, 160, 255), (184, 98, 122, 255)
TOP, TOP_L, TOP_D = (54, 196, 196, 255), (110, 224, 220, 255), (30, 140, 146, 255)
STAR = (255, 120, 184, 255)
PANTS, PANTS_D = (64, 72, 104, 255), (46, 52, 80, 255)
SHOE = (236, 236, 240, 255)
WHITE = (248, 248, 248, 255)
TEAR = (120, 190, 240, 255)
BLUSH = (236, 140, 140, 255)


def draw(lift=0, crouch=0, arms='down', mood='neutral', blink=False, tuck=False, sway=0, tear=False):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ground = H - 3
    feet_y = ground - lift
    leg_now = max(1, 6 - crouch - (2 if tuck else 0))
    torso_bot = feet_y - 1 - leg_now
    torso_top = torso_bot - 13
    t = torso_top - 19
    c = CX + sway

    # jeans and white trainers
    if not tuck:
        rect(d, c - 7, torso_bot + 1, c - 1, feet_y - 2, PANTS)
        rect(d, c + 1, torso_bot + 1, c + 7, feet_y - 2, PANTS)
        rect(d, c - 4, torso_bot + 1, c - 4, feet_y - 2, PANTS_D)
        rect(d, c + 4, torso_bot + 1, c + 4, feet_y - 2, PANTS_D)
        rect(d, c - 8, feet_y - 1, c - 1, feet_y, SHOE)
        rect(d, c + 1, feet_y - 1, c + 8, feet_y, SHOE)
    else:
        rect(d, c - 6, torso_bot + 1, c - 2, torso_bot + 2, PANTS)
        rect(d, c + 2, torso_bot + 1, c + 6, torso_bot + 2, PANTS)
        rect(d, c - 7, torso_bot + 3, c - 3, torso_bot + 4, SHOE)
        rect(d, c + 3, torso_bot + 3, c + 7, torso_bot + 4, SHOE)

    # arms in turquoise sleeves
    if arms == 'down':
        rect(d, c - 13, torso_top + 1, c - 10, torso_top + 7, TOP)
        rect(d, c + 10, torso_top + 1, c + 13, torso_top + 7, TOP)
        rect(d, c - 13, torso_top + 8, c - 10, torso_top + 11, SKIN)
        rect(d, c + 10, torso_top + 8, c + 13, torso_top + 11, SKIN)
    elif arms == 'up':
        rect(d, c - 14, torso_top - 3, c - 9, torso_top + 3, TOP)
        rect(d, c + 9, torso_top - 3, c + 14, torso_top + 3, TOP)
        rect(d, c - 15, torso_top - 7, c - 11, torso_top - 4, SKIN)
        rect(d, c + 11, torso_top - 7, c + 15, torso_top - 4, SKIN)
    elif arms == 'out':
        rect(d, c - 15, torso_top + 2, c - 9, torso_top + 5, TOP)
        rect(d, c + 9, torso_top + 2, c + 15, torso_top + 5, TOP)
        rect(d, c - 18, torso_top + 1, c - 15, torso_top + 5, SKIN)
        rect(d, c + 15, torso_top + 1, c + 18, torso_top + 5, SKIN)

    # turquoise shirt with a round neckline and little pink stars
    rect(d, c - 9, torso_top, c + 9, torso_top + 1, TOP)
    rect(d, c - 10, torso_top + 2, c + 10, torso_bot, TOP)
    rect(d, c - 3, torso_top, c + 2, torso_top + 1, SKIN)
    rect(d, c - 2, torso_top + 2, c + 1, torso_top + 2, SKIN)
    rect(d, c - 9, torso_top + 2, c - 8, torso_bot - 1, TOP_L)
    rect(d, c - 10, torso_bot, c + 10, torso_bot, TOP_D)
    for sx, sy in [(-5, 4), (4, 3), (0, 8), (-7, 10), (6, 9)]:
        x, y = c + sx, torso_top + sy
        if y < torso_bot:
            d.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], STAR)

    # head
    rect(d, c - 8, t + 6, c + 7, t + 18, SKIN)
    rect(d, c - 7, t + 5, c + 6, t + 19, SKIN)
    rect(d, c - 2, t + 19, c + 1, t + 19, SKIN_S)

    # short wavy blonde hair: full on top, swept over to her left, short at the back of the neck
    rect(d, c - 9, t + 1, c + 8, t + 6, HAIR)
    rect(d, c - 7, t, c + 6, t, HAIR)
    rect(d, c - 9, t + 7, c - 8, t + 13, HAIR)  # short side
    rect(d, c + 7, t + 6, c + 9, t + 12, HAIR)  # fuller swept side
    rect(d, c + 8, t + 13, c + 9, t + 14, HAIR)
    rect(d, c + 2, t + 6, c + 6, t + 7, HAIR)  # the sweep falling over the forehead
    d.point((c + 6, t + 8), HAIR)
    for x, y in [(-6, 2), (-2, 1), (2, 2), (5, 3), (-4, 4), (8, 8), (8, 11)]:
        d.point((c + x, t + y), HAIR_L)
        d.point((c + x + 1, t + y), HAIR_L)
    for x, y in [(-8, 5), (-1, 4), (3, 5), (7, 6), (-9, 10), (9, 13)]:
        d.point((c + x, t + y), HAIR_D)

    # dark rectangular glasses
    ey = t + 10
    for x0 in (c - 7, c + 1):
        rect(d, x0, ey - 2, x0 + 5, ey + 2, FRAME)
        rect(d, x0 + 1, ey - 1, x0 + 4, ey + 1, LENS)
    rect(d, c - 1, ey - 1, c, ey - 1, FRAME)
    d.point((c - 8, ey - 1), FRAME)
    d.point((c + 7, ey - 1), FRAME)
    for ex in (c - 5, c + 3):
        if blink:
            rect(d, ex, ey + 1, ex + 1, ey + 1, EYE)
        elif mood == 'happy':
            d.point((ex - 1, ey + 1), EYE)
            rect(d, ex, ey, ex + 1, ey, EYE)
            d.point((ex + 2, ey + 1), EYE)
        else:
            rect(d, ex, ey, ex + 1, ey + 1, EYE)
    if mood == 'glare':
        rect(d, c - 7, ey - 3, c - 3, ey - 3, HAIR_D)
        rect(d, c + 2, ey - 3, c + 6, ey - 3, HAIR_D)
    elif mood == 'sad':
        rect(d, c - 5, ey - 3, c - 3, ey - 3, HAIR_D)
        rect(d, c + 2, ey - 3, c + 4, ey - 3, HAIR_D)

    # nose and full pink lips
    rect(d, c - 1, t + 13, c, t + 13, SKIN_S)
    my = t + 16
    if mood == 'happy':
        rect(d, c - 3, my - 1, c + 2, my - 1, LIPS)
        rect(d, c - 2, my, c + 1, my, (120, 40, 50, 255))
        rect(d, c - 2, my + 1, c + 1, my + 1, LIPS)
        d.point((c - 6, my - 3), BLUSH)
        d.point((c + 5, my - 3), BLUSH)
    elif mood == 'sad':
        rect(d, c - 2, my, c + 1, my, LIPS)
        d.point((c - 3, my + 1), LIPS_D)
        d.point((c + 2, my + 1), LIPS_D)
    else:
        rect(d, c - 2, my - 1, c + 1, my - 1, LIPS)
        rect(d, c - 3, my, c + 2, my, LIPS_D)
        rect(d, c - 2, my + 1, c + 1, my + 1, LIPS)
    if tear:
        rect(d, c - 6, ey + 3, c - 6, ey + 4, TEAR)
    return outline(img)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    picks = []
    for name, frames in ANIMS.items():
        imgs = [with_shadow(draw(**a), a.get('lift', 0)) for a in frames]
        sheet = Image.new('RGBA', (W * len(imgs), H), (0, 0, 0, 0))
        for i, f in enumerate(imgs):
            sheet.paste(f, (i * W, 0))
        sheet.save(OUT / f'{name}_sheet.png')
        picks += imgs[:2]
    if len(sys.argv) > 1:
        prev = Image.new('RGBA', (W * len(picks), H), (232, 226, 214, 255))
        for i, f in enumerate(picks):
            prev.alpha_composite(f, (i * W, 0))
        prev.resize((prev.width * 6, prev.height * 6), Image.NEAREST).save(sys.argv[1])
    Image.open(OUT / 'idle_sheet.png').crop((0, 0, W, H)).save(OUT / 'icon.png')
