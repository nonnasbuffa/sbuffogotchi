"""Draws the "Boxer" shop skin: a grey-tracksuit guy with spiky silver hair, in the pet's 44x54 frames.

Same animations, frame counts and timings as make_sprites.py, so the game can swap sheets freely.
Writes www/sprites/skins/boxer/{idle,happy,sad,battle}_sheet.png and a preview in the scratch folder.
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'www' / 'sprites' / 'skins' / 'boxer'
W, H, CX = 44, 54, 22
OUTLINE = (34, 26, 32, 255)
SKIN, SKIN_S, SKIN_D = (236, 186, 150, 255), (210, 150, 116, 255), (160, 104, 84, 255)
STUBBLE = (196, 160, 136, 255)
HAIR, HAIR_L, HAIR_D = (214, 214, 220, 255), (248, 248, 252, 255), (160, 160, 172, 255)
EYE = (52, 40, 36, 255)
SUIT, SUIT_L, SUIT_D = (150, 150, 158, 255), (176, 176, 184, 255), (112, 112, 122, 255)
WHITE = (248, 248, 248, 255)
SHOE = (40, 40, 48, 255)
TEAR = (120, 190, 240, 255)
RED = (214, 74, 54, 255)


def rect(d, x0, y0, x1, y1, c):
    if x1 >= x0 and y1 >= y0:
        d.rectangle([x0, y0, x1, y1], fill=c)


def outline(img):
    px, out = img.load(), img.copy()
    o = out.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3]:
                continue
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= x + a < W and 0 <= y + b < H and px[x + a, y + b][3]:
                    o[x, y] = OUTLINE
                    break
    return out


def draw(lift=0, crouch=0, arms='down', mood='neutral', blink=False, tuck=False, sway=0, tear=False):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ground = H - 3
    feet_y = ground - lift
    leg_now = max(1, 6 - crouch - (2 if tuck else 0))
    torso_bot = feet_y - 1 - leg_now
    torso_top = torso_bot - 13
    t = torso_top - 19  # head origin
    c = CX + sway

    # sweatpants with the little white logo on one leg, and dark trainers
    if not tuck:
        rect(d, c - 7, torso_bot + 1, c - 1, feet_y - 2, SUIT)
        rect(d, c + 1, torso_bot + 1, c + 7, feet_y - 2, SUIT)
        rect(d, c - 7, feet_y - 2, c - 1, feet_y - 2, SUIT_D)  # cuffs
        rect(d, c + 1, feet_y - 2, c + 7, feet_y - 2, SUIT_D)
        if leg_now >= 4:
            rect(d, c + 4, torso_bot + 2, c + 6, torso_bot + 2, WHITE)
        rect(d, c - 8, feet_y - 1, c - 1, feet_y, SHOE)
        rect(d, c + 1, feet_y - 1, c + 8, feet_y, SHOE)
    else:
        rect(d, c - 6, torso_bot + 1, c - 2, torso_bot + 2, SUIT)
        rect(d, c + 2, torso_bot + 1, c + 6, torso_bot + 2, SUIT)
        rect(d, c - 7, torso_bot + 3, c - 3, torso_bot + 4, SHOE)
        rect(d, c + 3, torso_bot + 3, c + 7, torso_bot + 4, SHOE)

    # hoodie sleeves; "up" is the friendly wave from the photo
    if arms == 'down':
        rect(d, c - 13, torso_top + 1, c - 10, torso_top + 9, SUIT)
        rect(d, c + 10, torso_top + 1, c + 13, torso_top + 9, SUIT)
        rect(d, c - 13, torso_top + 10, c - 10, torso_top + 11, SKIN)
        rect(d, c + 10, torso_top + 10, c + 13, torso_top + 11, SKIN)
    elif arms == 'up':
        rect(d, c - 14, torso_top - 3, c - 9, torso_top + 3, SUIT)
        rect(d, c + 9, torso_top - 3, c + 14, torso_top + 3, SUIT)
        rect(d, c - 15, torso_top - 7, c - 11, torso_top - 4, SKIN)
        rect(d, c + 11, torso_top - 7, c + 15, torso_top - 4, SKIN)
    elif arms == 'out':  # guard up, fists ready
        rect(d, c - 15, torso_top + 2, c - 9, torso_top + 5, SUIT)
        rect(d, c + 9, torso_top + 2, c + 15, torso_top + 5, SUIT)
        rect(d, c - 18, torso_top + 1, c - 15, torso_top + 5, SKIN)
        rect(d, c + 15, torso_top + 1, c + 18, torso_top + 5, SKIN)
        d.point((c - 17, torso_top + 3), SKIN_S)
        d.point((c + 16, torso_top + 3), SKIN_S)

    # zip-up hoodie: hood behind the neck, zipper, drawstrings, chest logo and front pocket
    rect(d, c - 7, torso_top - 1, c + 6, torso_top + 1, SUIT_D)  # hood
    rect(d, c - 9, torso_top, c + 9, torso_top + 1, SUIT)
    rect(d, c - 10, torso_top + 2, c + 10, torso_bot - 1, SUIT)
    rect(d, c - 10, torso_bot, c + 10, torso_bot, SUIT_D)  # waistband
    rect(d, c, torso_top + 1, c, torso_bot, SUIT_L)  # zipper
    for x in (c - 3, c + 3):
        rect(d, x, torso_top + 1, x, torso_top + 4, SUIT_L)
    rect(d, c + 4, torso_top + 4, c + 8, torso_top + 4, WHITE)  # BOXING
    rect(d, c + 4, torso_top + 6, c + 7, torso_top + 6, WHITE)
    rect(d, c - 7, torso_bot - 5, c + 7, torso_bot - 5, SUIT_D)  # pocket
    d.point((c - 8, torso_bot - 4), SUIT_D)
    d.point((c + 8, torso_bot - 4), SUIT_D)

    # head: broad face, neck, ears
    rect(d, c - 8, t + 6, c + 7, t + 18, SKIN)
    rect(d, c - 7, t + 5, c + 6, t + 19, SKIN)
    rect(d, c - 2, t + 19, c + 1, t + 19, SKIN_S)
    rect(d, c - 9, t + 10, c - 9, t + 13, SKIN_S)
    rect(d, c + 8, t + 10, c + 8, t + 13, SKIN_S)

    # short spiky silver hair, swept up
    rect(d, c - 8, t + 3, c + 7, t + 6, HAIR)
    rect(d, c - 8, t + 7, c - 8, t + 9, HAIR)
    rect(d, c + 7, t + 7, c + 7, t + 9, HAIR)
    # a solid crop whose top edge is jagged spikes, no gaps between them
    heights = [1, 2, 3, 2, 4, 3, 5, 4, 5, 3, 4, 2, 3, 2, 1, 0]
    for x, h in zip(range(-8, 8), heights):
        rect(d, c + x, t + 2 - h, c + x, t + 3, HAIR)
        if h >= 3:
            d.point((c + x, t + 2 - h), HAIR_L)
    for x in (-5, -1, 3):
        d.point((c + x, t + 1), HAIR_D)
    rect(d, c - 4, t + 4, c + 3, t + 4, HAIR_L)

    # brows and eyes
    ey = t + 10
    if mood == 'glare':
        rect(d, c - 6, ey - 2, c - 3, ey - 2, HAIR_D)
        rect(d, c + 2, ey - 2, c + 5, ey - 2, HAIR_D)
        d.point((c - 3, ey - 1), HAIR_D)
        d.point((c + 2, ey - 1), HAIR_D)
    elif mood == 'sad':
        d.point((c - 6, ey - 1), HAIR_D); rect(d, c - 5, ey - 2, c - 4, ey - 2, HAIR_D)
        rect(d, c + 3, ey - 2, c + 4, ey - 2, HAIR_D); d.point((c + 5, ey - 1), HAIR_D)
    else:
        rect(d, c - 6, ey - 2, c - 3, ey - 2, HAIR_D)
        rect(d, c + 2, ey - 2, c + 5, ey - 2, HAIR_D)
    for ex in (c - 5, c + 3):
        if blink:
            rect(d, ex, ey + 1, ex + 1, ey + 1, EYE)
        elif mood == 'happy':
            d.point((ex - 1, ey + 1), EYE)
            rect(d, ex, ey, ex + 1, ey, EYE)
            d.point((ex + 2, ey + 1), EYE)
        else:
            rect(d, ex, ey, ex + 1, ey + 1, EYE)
            d.point((ex, ey), WHITE)

    # nose, stubble along the jaw and mouth
    rect(d, c - 1, t + 13, c, t + 13, SKIN_S)
    d.point((c - 2, t + 13), SKIN_D)
    for x in range(-7, 7):
        if x % 2 == 0:
            d.point((c + x, t + 18), STUBBLE)
        else:
            d.point((c + x, t + 19 if -3 < x < 3 else t + 17), STUBBLE)
    my = t + 15
    if mood == 'happy':
        rect(d, c - 4, my, c + 3, my, EYE)
        rect(d, c - 3, my + 1, c + 2, my + 1, (168, 62, 66, 255))
        rect(d, c - 2, my + 2, c + 1, my + 2, EYE)
        d.point((c - 6, my - 1), RED)
        d.point((c + 5, my - 1), RED)
    elif mood == 'sad':
        rect(d, c - 2, my, c + 1, my, EYE)
        d.point((c - 3, my + 1), EYE)
        d.point((c + 2, my + 1), EYE)
    elif mood == 'glare':
        rect(d, c - 3, my, c + 2, my, EYE)
    else:  # the photo's lopsided grin
        rect(d, c - 3, my + 1, c + 1, my + 1, SKIN_D)
        d.point((c + 2, my), SKIN_D)
        d.point((c + 3, my - 1), SKIN_D)
    if tear:
        rect(d, c - 6, ey + 3, c - 6, ey + 4, TEAR)
    return outline(img)


def with_shadow(frame, lift=0):
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    r = max(4, 11 - lift)
    ImageDraw.Draw(base).rectangle([CX - r, H - 3, CX + r, H - 2], fill=(0, 0, 0, 70))
    base.alpha_composite(frame)
    return base


# Same frames as the pet (make_sprites.py), so ANIMS timings in game.js still match.
ANIMS = {
    'idle': [dict(), dict(crouch=1), dict(), dict(crouch=1, blink=True)],
    'happy': [dict(crouch=3, mood='happy'), dict(lift=3, arms='up', mood='happy'),
              dict(lift=7, arms='up', tuck=True, mood='happy'), dict(lift=8, arms='up', tuck=True, mood='happy'),
              dict(lift=5, arms='up', tuck=True, mood='happy'), dict(lift=1, arms='out', mood='happy'),
              dict(crouch=3, arms='out', mood='happy'), dict(mood='happy')],
    'sad': [dict(mood='sad', crouch=2, tear=True), dict(mood='sad', crouch=3, sway=-1),
            dict(mood='sad', crouch=2, blink=True), dict(mood='sad', crouch=3, sway=1, tear=True)],
    'battle': [dict(mood='glare', arms='out'), dict(mood='glare', arms='out', crouch=1),
               dict(mood='glare', arms='out', sway=1), dict(mood='glare', arms='out', crouch=1)],
}

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
    if len(sys.argv) > 1:  # optional preview path
        prev = Image.new('RGBA', (W * len(picks), H), (232, 226, 214, 255))
        for i, f in enumerate(picks):
            prev.alpha_composite(f, (i * W, 0))
        prev.resize((prev.width * 6, prev.height * 6), Image.NEAREST).save(sys.argv[1])
    # Shop picture: the first idle frame of this skin and of the normal pet.
    Image.open(OUT / 'idle_sheet.png').crop((0, 0, W, H)).save(OUT / 'icon.png')
    Image.open(OUT.parent.parent / 'idle_sheet.png').crop((0, 0, W, H)).save(OUT.parent / 'default_icon.png')
