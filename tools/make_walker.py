"""Draws her small top-down walking sprites: rows face down, up and side; columns are the step cycle."""
from PIL import Image
from make_veggies import OUT, canvas, blob, outlined

W, H = 16, 22
HAIR, HAIR2 = (32, 26, 36, 255), (70, 62, 80, 255)
SKIN, GLASSES, EYE = (232, 180, 140, 255), (226, 150, 176, 255), (40, 28, 30, 255)
TOP, TOP2, FLOWER = (28, 96, 86, 255), (18, 70, 64, 255), (226, 74, 62, 255)
LEGS, SHOE = (58, 52, 76, 255), (112, 70, 50, 255)


def frame(facing, step):
    im, d = canvas(W, H)
    bob = 1 if step in (1, 3) else 0
    # Legs: one foot forward on each step.
    left, right = (1, 0) if step == 1 else (0, 1) if step == 3 else (0, 0)
    if facing == 'side':
        d.rectangle([6, 16, 9, 18 - left], fill=LEGS)
        d.rectangle([6 - left * 2 + right * 2, 18, 9 - left * 2 + right * 2, 19], fill=SHOE)
    else:
        d.rectangle([4, 16, 6, 19 - left], fill=LEGS)
        d.rectangle([9, 16, 11, 19 - right], fill=LEGS)
        d.rectangle([4, 19 - left, 6, 20 - left], fill=SHOE)
        d.rectangle([9, 19 - right, 11, 20 - right], fill=SHOE)
    # Body, arms and head move together with the bob.
    y = -bob
    d.rectangle([3, 11 + y, 12, 16 + y], fill=TOP)
    d.rectangle([3, 15 + y, 12, 16 + y], fill=TOP2)
    if facing == 'side':
        d.rectangle([7 + right - left, 12 + y, 8 + right - left, 15 + y], fill=SKIN)
    else:
        d.rectangle([1, 12 + y, 2, 15 + y - left], fill=SKIN)
        d.rectangle([13, 12 + y, 14, 15 + y - right], fill=SKIN)
    if facing == 'down':
        d.point([(6, 13 + y), (9, 13 + y)], fill=FLOWER)
    # Curly hair around the face.
    for cx, cy, r in [(4, 6, 3), (11, 6, 3), (8, 3, 4), (3, 9, 2), (12, 9, 2)]:
        blob(d, cx, cy + y, r, r, HAIR)
    if facing == 'down':
        d.rectangle([5, 6 + y, 10, 11 + y], fill=SKIN)
        d.line([5, 8 + y, 10, 8 + y], fill=GLASSES)
        d.point([(6, 8 + y), (9, 8 + y)], fill=EYE)
    elif facing == 'side':
        d.rectangle([8, 6 + y, 12, 11 + y], fill=SKIN)
        d.line([9, 8 + y, 12, 8 + y], fill=GLASSES)
        d.point((11, 8 + y), fill=EYE)
    else:
        blob(d, 8, 8 + y, 4, 3, HAIR)
    d.point([(5, 3 + y), (10, 4 + y), (3, 7 + y), (12, 7 + y), (8, 2 + y)], fill=HAIR2)
    return outlined(im)


if __name__ == '__main__':
    sheet = Image.new('RGBA', (W * 4, H * 3), (0, 0, 0, 0))
    for row, facing in enumerate(['down', 'up', 'side']):
        for col in range(4):
            sheet.alpha_composite(frame(facing, col), (col * W, row * H))
    sheet.save(OUT / 'walker.png')
    frame('down', 0).save(OUT / 'icons' / 'walker.png')
