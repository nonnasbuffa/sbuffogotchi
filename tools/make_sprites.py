from PIL import Image, ImageDraw
import os

OUT = os.path.dirname(os.path.abspath(__file__))
W, H, CX = 44, 54, 22
OUTLINE = (34, 24, 32, 255)
SKIN, SKIN_S, SKIN_D = (240, 190, 154, 255), (214, 154, 120, 255), (168, 108, 88, 255)
HAIR, HAIR_L = (28, 24, 34, 255), (66, 58, 78, 255)
FRAME, FRAME_D = (222, 158, 172, 255), (156, 84, 104, 255)
LENS = (236, 232, 240, 255)
EYE = (52, 38, 36, 255)
TOP, TOP_D = (24, 92, 84, 255), (14, 64, 62, 255)
RED, CREAM = (214, 74, 54, 255), (240, 214, 176, 255)
PANTS, SHOE = (58, 54, 78, 255), (120, 72, 60, 255)
TEAR = (120, 190, 240, 255)

STYLES = {
    "A_chibi": dict(body=0, curls=0),
}


def rect(d, x0, y0, x1, y1, c):
    if x1 >= x0 and y1 >= y0:
        d.rectangle([x0, y0, x1, y1], fill=c)


def blob(d, x, y, r, c):
    d.ellipse([x - r, y - r, x + r, y + r], fill=c)


def outline(img):
    px = img.load()
    out = img.copy()
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


def draw(style, lift=0, crouch=0, arms="down", mood="neutral", blink=False, tuck=False, sway=0, tear=False):
    """lift = whole body off the ground; crouch = upper body sinks into the legs."""
    s = STYLES[style]
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ground = H - 3
    leg = 4 + s["body"] // 2
    torso = 9 + s["body"] - s["body"] // 2
    feet_y = ground - lift
    leg_now = max(1, leg - crouch - (2 if tuck else 0))
    torso_bot = feet_y - 1 - leg_now
    torso_top = torso_bot - torso + 1
    t = torso_top - 18  # head origin
    c = CX + sway

    # hair behind the head: lumpy clouds of curls
    for x, y, r in [(-10, 8, 4), (10, 8, 4), (-11, 13, 4), (11, 13, 4), (-10, 17, 3), (10, 17, 3),
                    (-7, 3, 4), (7, 3, 4), (0, 1, 5), (-4, 1, 4), (4, 1, 4)]:
        blob(d, c + x, t + y, r, HAIR)
    # small round lumps give a soft, curly outline
    for x, y in [(-13, 5), (13, 5), (-15, 10), (15, 10), (-15, 15), (15, 15), (-13, 20), (13, 20),
                 (-10, 22), (10, 22), (-9, -1), (9, -1), (-4, -4), (3, -4)]:
        blob(d, c + x, t + y, 2, HAIR)
    if s["curls"]:
        for x, y, r in [(-14, 9, 3), (14, 9, 3), (-14, 16, 3), (14, 16, 3), (-11, 2, 3), (11, 2, 3),
                        (-5, -3, 3), (5, -3, 3), (-12, 23, 2), (12, 23, 2)]:
            blob(d, c + x, t + y, r, HAIR)

    # legs and shoes
    if not tuck:
        rect(d, c - 7, torso_bot + 1, c - 1, feet_y - 2, PANTS)
        rect(d, c + 1, torso_bot + 1, c + 7, feet_y - 2, PANTS)
        rect(d, c - 8, feet_y - 1, c - 1, feet_y, SHOE)
        rect(d, c + 1, feet_y - 1, c + 8, feet_y, SHOE)
    else:
        rect(d, c - 6, torso_bot + 1, c - 2, torso_bot + 2, PANTS)
        rect(d, c + 2, torso_bot + 1, c + 6, torso_bot + 2, PANTS)
        rect(d, c - 7, torso_bot + 3, c - 3, torso_bot + 4, SHOE)
        rect(d, c + 3, torso_bot + 3, c + 7, torso_bot + 4, SHOE)

    # arms
    if arms == "down":
        rect(d, c - 13, torso_top + 1, c - 10, torso_top + 6, TOP)
        rect(d, c + 10, torso_top + 1, c + 13, torso_top + 6, TOP)
        rect(d, c - 13, torso_top + 7, c - 10, torso_top + 8, SKIN)
        rect(d, c + 10, torso_top + 7, c + 13, torso_top + 8, SKIN)
    elif arms == "up":
        rect(d, c - 14, torso_top - 3, c - 9, torso_top + 3, TOP)
        rect(d, c + 9, torso_top - 3, c + 14, torso_top + 3, TOP)
        rect(d, c - 15, torso_top - 6, c - 11, torso_top - 4, SKIN)
        rect(d, c + 11, torso_top - 6, c + 15, torso_top - 4, SKIN)
    elif arms == "out":
        rect(d, c - 15, torso_top + 1, c - 9, torso_top + 4, TOP)
        rect(d, c + 9, torso_top + 1, c + 15, torso_top + 4, TOP)
        rect(d, c - 18, torso_top + 1, c - 16, torso_top + 4, SKIN)
        rect(d, c + 16, torso_top + 1, c + 18, torso_top + 4, SKIN)

    # blouse with a V-neck and a floral print
    rect(d, c - 8, torso_top, c + 8, torso_top + 1, TOP)  # shoulders
    rect(d, c - 10, torso_top + 2, c + 10, torso_bot - 1, TOP)  # round belly
    rect(d, c - 9, torso_bot, c + 9, torso_bot, TOP_D)
    rect(d, c - 10, torso_bot - 1, c + 10, torso_bot - 1, TOP_D)
    for i in range(3):
        rect(d, c - 2 + i, torso_top + i, c + 2 - i, torso_top + i, SKIN)
    for x, y in [(-6, 4), (6, 4), (0, 5)]:
        fx, fy = c + x, torso_top + y
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.point((fx + a, fy + b), RED)
        d.point((fx, fy), CREAM)

    # head
    rect(d, c - 8, t + 4, c + 7, t + 17, SKIN)
    rect(d, c - 7, t + 3, c + 6, t + 18, SKIN)
    rect(d, c - 2, t + 18, c + 1, t + 19, SKIN_S)  # neck
    rect(d, c - 7, t + 17, c + 6, t + 18, SKIN_S)
    rect(d, c - 8, t + 13, c - 8, t + 16, SKIN_S)

    # fringe of curls
    for x, y, r in [(-6, 3, 2), (-2, 2, 2), (2, 2, 2), (6, 3, 2)]:
        blob(d, c + x, t + y, r, HAIR)
    # little ringlet arcs across the hair
    for x, y in [(-14, 7), (-13, 12), (-14, 17), (-11, 3), (-7, -1), (-2, -3), (3, -2), (8, 1),
                 (11, 6), (12, 11), (12, 16), (-5, 2), (0, 1), (4, 3)]:
        d.point((c + x, t + y + 1), HAIR_L)
        d.point((c + x + 1, t + y), HAIR_L)
        d.point((c + x + 2, t + y + 1), HAIR_L)

    # furrowed brow
    if mood != "happy":
        d.point((c - 1, t + 6), SKIN_D)
        d.point((c, t + 6), SKIN_D)
        rect(d, c - 5, t + 7, c - 3, t + 7, SKIN_D)
        rect(d, c + 2, t + 7, c + 4, t + 7, SKIN_D)

    # cat-eye glasses
    gy = t + 8
    for lx in (c - 7, c + 1):
        rect(d, lx, gy, lx + 5, gy + 4, FRAME)
        rect(d, lx + 1, gy + 1, lx + 4, gy + 3, LENS)
    rect(d, c - 1, gy + 1, c, gy + 1, FRAME_D)
    d.point((c - 8, gy - 1), FRAME)
    d.point((c - 8, gy), FRAME)
    d.point((c + 7, gy - 1), FRAME)
    d.point((c + 7, gy), FRAME)
    d.point((c - 6, gy), FRAME_D)
    d.point((c + 5, gy), FRAME_D)

    # eyes
    for ex in (c - 5, c + 3):
        if blink:
            rect(d, ex, gy + 2, ex + 1, gy + 2, EYE)
        elif mood == "happy":
            lx = ex - 1  # a wide arc filling the lens reads as a smile
            d.point((lx, gy + 3), EYE)
            rect(d, lx + 1, gy + 2, lx + 2, gy + 2, EYE)
            d.point((lx + 3, gy + 3), EYE)
        elif mood == "glare":
            rect(d, ex - 1, gy + 1, ex + 2, gy + 1, SKIN_S)  # heavy eyelid
            rect(d, ex, gy + 2, ex + 1, gy + 3, EYE)
        else:
            rect(d, ex, gy + 1, ex + 1, gy + 3, EYE)
            d.point((ex, gy + 1), (255, 255, 255, 255))

    # wrinkles: forehead, crow's feet, under the eyes, smile lines, jowls and chin
    rect(d, c - 4, t + 5, c + 3, t + 5, SKIN_S)
    for x, y in [(-8, 11), (-8, 12), (7, 11), (7, 12), (-6, 13), (-5, 13), (-4, 13), (3, 13), (4, 13), (5, 13),
                 (-4, 14), (-5, 15), (-5, 16), (3, 14), (4, 15), (4, 16), (-7, 15), (-7, 16), (6, 15), (6, 16),
                 (-2, 17), (-1, 17), (0, 17), (1, 17)]:
        d.point((c + x, t + y), SKIN_S)

    # nose, cheeks and mouth
    rect(d, c - 1, t + 13, c, t + 13, SKIN_S)
    my = t + 15
    if mood == "happy":
        rect(d, c - 4, my, c + 3, my, EYE)
        rect(d, c - 3, my + 1, c + 2, my + 1, (168, 62, 66, 255))
        rect(d, c - 2, my + 2, c + 1, my + 2, EYE)
        d.point((c - 6, my - 1), RED)
        d.point((c + 5, my - 1), RED)
    elif mood == "sad":
        rect(d, c - 2, my, c + 1, my, EYE)
        d.point((c - 3, my + 1), EYE)
        d.point((c + 2, my + 1), EYE)
    else:
        rect(d, c - 3, my, c + 2, my, SKIN_D)
    if tear:
        rect(d, c - 6, gy + 5, c - 6, gy + 6, TEAR)
    return outline(img)


def with_shadow(frame, lift=0):
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    r = max(4, 11 - lift)
    ImageDraw.Draw(base).rectangle([CX - r, H - 3, CX + r, H - 2], fill=(0, 0, 0, 70))
    base.alpha_composite(frame)
    return base


def anim(style, name):
    if name == "idle":
        return [(dict(), 500), (dict(crouch=1), 450), (dict(), 500), (dict(crouch=1, blink=True), 140)]
    if name == "happy":
        h = dict(mood="happy")
        return [(dict(crouch=3, arms="down", **h), 110), (dict(lift=3, arms="up", tuck=False, **h), 70),
                (dict(lift=7, arms="up", tuck=True, **h), 90), (dict(lift=8, arms="up", tuck=True, **h), 110),
                (dict(lift=5, arms="up", tuck=True, **h), 70), (dict(lift=1, arms="out", **h), 60),
                (dict(crouch=3, arms="out", **h), 110), (dict(**h), 140)]
    if name == "battle":
        g = dict(mood="glare", arms="out")
        return [(dict(**g), 600), (dict(crouch=1, **g), 400), (dict(sway=1, **g), 300), (dict(crouch=1, **g), 400)]
    return [(dict(mood="sad", crouch=2, tear=True), 700), (dict(mood="sad", crouch=3, sway=-1), 600),
            (dict(mood="sad", crouch=2, blink=True), 180), (dict(mood="sad", crouch=3, sway=1, tear=True), 600)]


def scale_frame(f, k):
    # GIF transparency is awkward in previews, so use a soft room colour.
    bg = Image.new("RGBA", f.size, (232, 226, 214, 255))
    bg.alpha_composite(f)
    return bg.convert("RGB").resize((f.width * k, f.height * k), Image.NEAREST)


rows = []
for style in STYLES:
    os.makedirs(os.path.join(OUT, style), exist_ok=True)
    row = []
    for name in ("idle", "happy", "sad", "battle"):
        fr = anim(style, name)
        frames = [with_shadow(draw(style, **a), a.get("lift", 0)) for a, _ in fr]
        sheet = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            sheet.paste(f, (i * W, 0))
        sheet.save(os.path.join(OUT, style, f"{name}_sheet.png"))
        big = [scale_frame(f, 6) for f in frames]
        big[0].save(os.path.join(OUT, style, f"{name}.gif"), save_all=True, append_images=big[1:],
                    duration=[ms for _, ms in fr], loop=0, disposal=2)
        row.append(frames)
    rows.append(row)

# one preview: a row per style showing the happy jump next to idle and sad
cols = 8
sheet = Image.new("RGBA", (W * cols * 5, H * len(rows) * 5), (232, 226, 214, 255))
for r, row in enumerate(rows):
    picks = [row[0][0], row[1][0], row[1][1], row[1][2], row[1][3], row[1][5], row[2][0], row[3][0]]
    for i, f in enumerate(picks):
        sheet.alpha_composite(f.resize((W * 5, H * 5), Image.NEAREST), (i * W * 5, r * H * 5))
sheet.convert("RGB").save(os.path.join(OUT, "preview.png"))

# all three happy jumps side by side as one GIF
happy = [anim(s, "happy") for s in STYLES]
strip = []
for i in range(len(happy[0])):
    canvas = Image.new("RGBA", (W * 3, H), (232, 226, 214, 255))
    for j, s in enumerate(STYLES):
        a = happy[j][i][0]
        canvas.alpha_composite(with_shadow(draw(s, **a), a.get("lift", 0)), (j * W, 0))
    strip.append(canvas.convert("RGB").resize((W * 18, H * 6), Image.NEAREST))
strip[0].save(os.path.join(OUT, "happy_compare.gif"), save_all=True, append_images=strip[1:],
              duration=[ms for _, ms in happy[0]], loop=0)
print("ok")
