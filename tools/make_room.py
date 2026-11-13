"""Draws her room, the home-screen background, into www/sprites/room.png.

It is 96x72 pixels (4:3) and is shown scaled up with crisp pixels, bottom-aligned so the floor
always sits under her feet. Furniture stays near the sides because she stands in the middle.
"""
from PIL import Image, ImageDraw
from make_veggies import OUT

W, H = 96, 72
FLOOR_Y = 50  # The floor starts here, matching the old 72% wall / 28% floor split.

WALL, WALL_STRIPE = (239, 230, 212), (228, 216, 194)
TRIM, TRIM_DARK = (150, 104, 70), (112, 76, 50)
WOOD, WOOD_DARK, WOOD_LIGHT = (201, 160, 116), (172, 130, 90), (218, 184, 140)
FRAME, FRAME_DARK = (120, 82, 52), (84, 56, 36)
SKY, SKY_LIGHT, CLOUD = (120, 196, 236), (168, 220, 244), (250, 250, 250)
LEAF, LEAF_DARK, POT = (96, 170, 84), (58, 120, 62), (200, 96, 70)
RUG, RUG_EDGE = (214, 112, 130), (178, 78, 100)
GOLD, INK = (255, 200, 60), (27, 21, 37)


def room():
    im = Image.new('RGB', (W, H), WALL)
    d = ImageDraw.Draw(im)
    # Striped wallpaper and a wooden skirting board.
    for x in range(0, W, 8):
        d.line([x + 3, 0, x + 3, FLOOR_Y - 4], fill=WALL_STRIPE)
        d.line([x + 4, 0, x + 4, FLOOR_Y - 4], fill=WALL_STRIPE)
    d.rectangle([0, FLOOR_Y - 3, W, FLOOR_Y - 1], fill=TRIM)
    d.line([0, FLOOR_Y - 3, W, FLOOR_Y - 3], fill=TRIM_DARK)

    # Wooden floor: planks with staggered seams.
    d.rectangle([0, FLOOR_Y, W, H], fill=WOOD)
    for i, y in enumerate(range(FLOOR_Y, H, 5)):
        d.line([0, y, W, y], fill=WOOD_DARK)
        for x in range(i % 2 * 12, W, 24):
            d.line([x, y + 1, x, y + 4], fill=WOOD_DARK)
        d.line([0, y + 1, W, y + 1], fill=WOOD_LIGHT)

    # A round rug under her.
    d.ellipse([22, 60, 74, 71], fill=RUG_EDGE)
    d.ellipse([24, 61, 72, 70], fill=RUG)
    d.ellipse([34, 63, 62, 68], fill=RUG_EDGE)

    # Window on the left, with sky and a cloud.
    d.rectangle([5, 10, 27, 34], fill=FRAME_DARK)
    d.rectangle([7, 12, 25, 32], fill=SKY)
    d.rectangle([7, 12, 25, 18], fill=SKY_LIGHT)
    d.ellipse([9, 20, 17, 25], fill=CLOUD)
    d.ellipse([13, 18, 21, 24], fill=CLOUD)
    d.line([16, 12, 16, 32], fill=FRAME)
    d.line([7, 22, 25, 22], fill=FRAME)
    d.rectangle([3, 34, 29, 36], fill=FRAME)

    # Framed picture of a poke bowl on the right.
    d.rectangle([68, 9, 88, 25], fill=FRAME_DARK)
    d.rectangle([70, 11, 86, 23], fill=(250, 240, 222))
    d.ellipse([72, 13, 84, 19], fill=(250, 250, 250))
    d.point([(75, 15), (78, 14), (81, 16)], fill=(226, 74, 62))
    d.point([(77, 16), (80, 15)], fill=LEAF)
    d.polygon([(72, 17), (84, 17), (82, 22), (74, 22)], fill=(70, 120, 200))
    d.line([72, 17, 84, 17], fill=(150, 190, 240))

    # Shelf with a trophy and a plant.
    d.rectangle([66, 33, 92, 34], fill=FRAME)
    d.line([68, 35, 68, 37], fill=FRAME_DARK)
    d.line([90, 35, 90, 37], fill=FRAME_DARK)
    d.rectangle([70, 28, 74, 30], fill=GOLD)
    d.rectangle([71, 31, 73, 32], fill=(200, 130, 30))
    d.point([(69, 28), (75, 28)], fill=GOLD)
    d.rectangle([84, 29, 88, 32], fill=POT)
    for x, y in [(85, 27), (87, 26), (84, 25), (88, 28), (86, 25)]:
        d.point((x, y), fill=LEAF)
    d.point((86, 26), fill=LEAF_DARK)

    # Big potted plant on the floor, far left.
    d.rectangle([5, 52, 15, 60], fill=POT)
    d.line([5, 52, 15, 52], fill=(230, 130, 100))
    for cx, cy, r in [(10, 44, 5), (6, 47, 3), (14, 47, 3), (10, 39, 3)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=LEAF)
    d.line([10, 41, 10, 51], fill=LEAF_DARK)
    d.point([(8, 44), (12, 46), (7, 48)], fill=LEAF_DARK)

    # Little lamp table on the right.
    d.rectangle([80, 50, 91, 52], fill=FRAME)
    d.line([82, 53, 82, 62], fill=FRAME_DARK)
    d.line([89, 53, 89, 62], fill=FRAME_DARK)
    d.line([85, 44, 85, 49], fill=INK)
    d.polygon([(81, 38), (89, 38), (91, 44), (79, 44)], fill=(255, 214, 120))
    d.line([79, 44, 91, 44], fill=(230, 170, 70))
    return im


if __name__ == '__main__':
    room().save(OUT / 'room.png')
