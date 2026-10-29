"""Starter pixel art generator.

Run from the repo's main folder:
    python tools/make_sprites.py

Draws every sprite from the text grids below and saves them as PNGs:
  assets/sprites/classes/*.png   player classes (full color)
  assets/sprites/enemies/*.png   enemy bodies (grayscale, tinted in the game)
  assets/sprites/crown.png       drawn on top of bosses
  assets/sprites/items/*.png     gear icons (regular ones grayscale, tinted by tier)
  assets/sprites/armor/*.png     armor worn on each class (one per armor x class)
  assets/backgrounds/*.png       one scene per area

Each sprite file is a sheet of 2 frames side by side (32x16 pixels):
frame 1 is the drawing, frame 2 is the same drawing raised 1 pixel,
which makes a simple idle "bob" animation.

WARNING: running this again overwrites the PNGs. If you have edited
sprites in Piskel, back them up first or delete the ones you don't want
regenerated from the lists below.

Needs Pillow:  pip install pillow
"""
import random
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SIZE = 16

# ---------------------------------------------------------------
# Colors. Each character in a grid is one pixel.
# ---------------------------------------------------------------

# Enemies are grayscale. The game multiplies them by each enemy's color,
# so light grays become bright versions of that color and dark grays
# become shadows. Black stays black (outlines and eyes).
ENEMY_PALETTE = {
    "o": (20, 20, 20),     # outline
    "k": (0, 0, 0),        # eyes / mouth
    "d": (110, 110, 110),  # shadow
    "m": (180, 180, 180),  # body
    "l": (240, 240, 240),  # highlight
}

def class_palette(main, dark):
    return {
        "o": (13, 17, 23), "s": (241, 194, 125), "S": (201, 154, 91),
        "w": (255, 255, 255), "y": (255, 209, 102), "Y": (199, 149, 44),
        "g": (154, 165, 177), "G": (92, 103, 115), "b": (111, 247, 255),
        "h": (43, 49, 72), "H": (62, 71, 102), "a": main, "A": dark,
    }

# ---------------------------------------------------------------
# Player classes (facing right, toward the enemy)
# ---------------------------------------------------------------

CLASSES = {
    "defender": (class_palette((0, 200, 120), (0, 130, 80)), [
        "................",
        ".....oooo.......",
        "....oggggo......",
        "....ogGGgo......",
        "....ogbbgo......",
        "....oggggo......",
        "...ooaaaaoo.....",
        "..ogoaaaaoooooo.",
        "..ogoaAAaoyyyyyo",
        "..ogoaaaaoyaaayo",
        "..osoaaaaoyaAayo",
        "...ooaaaaoyaaayo",
        "....oGGGGooyyyo.",
        "....oGooGo.ooo..",
        "....oGo.oGo.....",
        "...ooo..ooo.....",
    ]),
    "analyst": (class_palette((79, 195, 247), (40, 120, 170)), [
        "................",
        ".....ooooo......",
        "....ohhhhho.....",
        "...ohhHHHhho....",
        "...ohHsbbbho....",
        "...ohHssssho....",
        "....ohhhhho.....",
        "...oaaaaaaao....",
        "..oaaAaaaaoggo..",
        "..oaaAaaasobbgo.",
        "..oaaAaaaaobbgo.",
        "..oaaaaaaaoggo..",
        "...oaaaaaao.....",
        "...oAAAAAAo.....",
        "....oo..oo......",
        "...ooo..ooo.....",
    ]),
    "cryptographer": (class_palette((224, 64, 251), (140, 30, 170)), [
        "................",
        ".....oo.........",
        "....oaao........",
        "....oaAao.......",
        "...oaaaAao......",
        "..oooooooooo....",
        "....osssso..oyo.",
        "....osoSso..yYy.",
        "....ossssoo.oyo.",
        "...oaaaaaaoooyo.",
        "..oaaaAaaasssyo.",
        "..oaaaAaaaao.yo.",
        "..oaaaAaaaao.yo.",
        "..oaaaAaaaao.yo.",
        "..oAAAAAAAAo.yo.",
        "...oooooooo..oo.",
    ]),
}

# ---------------------------------------------------------------
# Enemy body types (drawn facing right; the game flips them to face left)
# ---------------------------------------------------------------

ENEMIES = {
    "gremlin": [
        "................",
        "...o........o...",
        "...oo......oo...",
        "...omoooooomo...",
        "...ommmmmmmmo...",
        "..ommkmmmmkmmo..",
        "..ommkmmmmkmmo..",
        "..ommmmmmmmmmo..",
        "..omdmkkkkmdmo..",
        "...ommmmmmmmo...",
        "..ooommmmmmooo..",
        ".om.ommmmmmo.mo.",
        ".o..odmmmmdo..o.",
        "....odd..ddo....",
        "....oo....oo....",
        "................",
    ],
    "ghost": [
        "................",
        ".....oooooo.....",
        "....ommmmmmo....",
        "...ommlmmmmmo...",
        "...omlmmmmmmo...",
        "..ommkkmmkkmmo..",
        "..ommkkmmkkmmo..",
        "..ommmmmmmmmmo..",
        "..ommmmkkmmmmo..",
        "..ommmmmmmmmmo..",
        "..ommmmmmmmmmo..",
        "..ommmmmmmmmmo..",
        "..odmmmmmmmmdo..",
        "..odmdmmdmmdmo..",
        "..oo.oo.oo.oo...",
        "................",
    ],
    "golem": [
        "................",
        "....oooooooo....",
        "....ommmmmmo....",
        "....omkmmkmo....",
        "....ommmmmmo....",
        ".oooooddddooooo.",
        ".ommmmmmmmmmmmo.",
        ".ommoommmmoommo.",
        ".omo.ommmmo.omo.",
        ".omo.ommmmo.omo.",
        ".odo.oddddo.odo.",
        ".ooo.ommmmo.ooo.",
        ".....omoomo.....",
        ".....omoomo.....",
        "....oddoddo.....",
        "................",
    ],
    "swarm": [
        "................",
        ".ll.ll..........",
        "lllolll.........",
        ".ommmo....ll.ll.",
        "okmmmko..lllolll",
        ".ommmo....ommmo.",
        "..ooo....okmmmko",
        "..........ommmo.",
        "...........ooo..",
        ".....ll.ll......",
        "....lllolll.....",
        ".....ommmo......",
        "....okmmmko.....",
        ".....ommmo......",
        "......ooo.......",
        "................",
    ],
    "serpent": [
        "................",
        "..........ooo...",
        ".........ommmo..",
        "........ommkmmo.",
        "........ommmmmo.",
        ".........ommmo..",
        "..........omdo..",
        "....oooo..omdo..",
        "...ommmmo.omdo..",
        "..ommddmmoommo..",
        "..omdo.ommmmo...",
        "..omdo..oooo....",
        "..ommo..........",
        "...ommoooooooo..",
        "....odddddddmmo.",
        ".....oooooooooo.",
    ],
    "slime": [
        "................",
        "................",
        "................",
        "................",
        ".......oo.......",
        ".....oommoo.....",
        "....ommmmmmo....",
        "...ommlmmmmmo...",
        "...omlmmmmmmo...",
        "..ommkkmmkkmmo..",
        "..ommkkmmkkmmo..",
        "..ommmmmmmmmmo..",
        ".ommmmmkkmmmmmo.",
        ".odmmmmmmmmmmdo.",
        "..oddddddddddo..",
        "...oooooooooo...",
    ],
    "drone": [
        "................",
        ".......oo.......",
        ".......om.......",
        "....oooooooo....",
        "...ommmmmmmmo...",
        "...omkkmmkkmo...",
        "...omkkmmkkmo...",
        "...ommmmmmmmo...",
        "..oooooooooooo..",
        ".olomddddddomlo.",
        "..o.ommmmmmo.o..",
        "....ommmmmmo....",
        "....oddddddo....",
        ".....oo..oo.....",
        "....ooo..ooo....",
        "................",
    ],
    "wraith": [
        "................",
        ".....oooooo.....",
        "....ommmmmmo....",
        "...ommmmmmmmo...",
        "...omkkmmkkmo...",
        "...omkkmmkkmo...",
        "...ommmmmmmmo...",
        "....ommmkmmo....",
        "....omkmkmko....",
        ".....oooooo.....",
        "...oddmmmmddo...",
        "..odmmmmmmmmdo..",
        "..omdmmmmmmdmo..",
        "...odmdmmdmdo...",
        "....o.o..o.o....",
        "................",
    ],
    "crawler": [
        "................",
        "................",
        "................",
        "................",
        "................",
        ".o....oooo....o.",
        "..o..ommmmo..o..",
        "...oommmmmmoo...",
        ".oooomkmmkmoooo.",
        "o...ommmmmmo...o",
        "..ooommmmmmooo..",
        ".o..oddddddo..o.",
        "o....oooooo....o",
        "................",
        "................",
        "................",
    ],
    "sentinel": [
        "................",
        "....oooooooo....",
        "..oommmmmmmmoo..",
        ".ommmmllllmmmmo.",
        ".omlllkkkklllmo.",
        ".omllkkkkkkllmo.",
        ".omllkkllkkllmo.",
        ".omllkkkkkkllmo.",
        ".omlllkkkklllmo.",
        ".ommmmllllmmmmo.",
        "..oommmmmmmmoo..",
        "....oooooooo....",
        ".....o.oo.o.....",
        "....o..oo..o....",
        "...o...oo...o...",
        "................",
    ],
}

CROWN = (
    {"y": (255, 209, 102), "Y": (199, 149, 44), "r": (255, 56, 100), "o": (13, 17, 23)},
    [
        "y...yy...y",
        "yy.yyyy.yy",
        "yyyyyyyyyy",
        "yYyrYYryYy",
        "oooooooooo",
    ],
)


def grid_to_image(rows, palette, width, height):
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        if len(row) != width:
            raise ValueError(f"row {y} is {len(row)} pixels wide, expected {width}: {row!r}")
        for x, char in enumerate(row):
            if char != ".":
                image.putpixel((x, y), palette[char] + (255,))
    return image


def bottom_align(image):
    """Move the drawing down so its feet touch the bottom edge (the floor)."""
    box = image.getbbox()
    aligned = Image.new("RGBA", image.size, (0, 0, 0, 0))
    aligned.paste(image.crop(box), (box[0], image.height - (box[3] - box[1])))
    if box[3] - box[1] >= image.height:
        raise ValueError("sprite is too tall: leave at least 1 empty row for the bob animation")
    return aligned


def make_sheet(rows, palette):
    """Two frames side by side: the drawing, then the drawing raised 1 pixel."""
    frame = bottom_align(grid_to_image(rows, palette, SIZE, SIZE))
    sheet = Image.new("RGBA", (SIZE * 2, SIZE), (0, 0, 0, 0))
    sheet.paste(frame, (0, 0))
    sheet.paste(frame.crop((0, 1, SIZE, SIZE)), (SIZE, 0))
    return sheet


# ---------------------------------------------------------------
# Item icons (16x16, one frame)
# Regular items are grayscale and tinted by tier color in the game,
# like enemies. Legendaries are full color and never tinted.
# ---------------------------------------------------------------

LEGENDARY_PALETTE = {
    "o": (13, 17, 23), "k": (0, 0, 0), "y": (255, 209, 102), "Y": (199, 149, 44),
    "w": (255, 255, 255), "b": (111, 247, 255), "B": (0, 160, 190), "r": (255, 56, 100),
    "R": (170, 20, 60), "g": (154, 165, 177),
}

ITEMS = {
    # --- tools ---
    "packet-analyzer": (ENEMY_PALETTE, [
        "................",
        ".....oooo.......",
        "....ommmmo......",
        "...omddddmo.....",
        "..omdlddddmo....",
        "..omldddddmo....",
        "..omddddddmo....",
        "..omddddddmo....",
        "...omddddmo.....",
        "....ommmmdoo....",
        ".....oooo.oddo..",
        "...........oddo.",
        "............oddo",
        ".............oo.",
        "................",
        "................",
    ]),
    "port-scanner": (ENEMY_PALETTE, [
        "................",
        "...ooooooo......",
        "..olllllllo.....",
        ".olmmmmmmmlo....",
        ".olmmmmmmmmo..o.",
        "..olmmmmmmo..olo",
        "...odmmmdo..olo.",
        "....ooooo..olo..",
        "......o...olo...",
        ".....omo.olo....",
        ".....ommoloo....",
        "....ommmmmo.....",
        "...odddddddo....",
        "...ooooooooo....",
        "................",
        "................",
    ]),
    "hex-editor": (ENEMY_PALETTE, [
        "................",
        ".oooooooooooooo.",
        ".oddddddddddddo.",
        ".odkkkkkkkkkkdo.",
        ".odkllkkllkkkdo.",
        ".odkkkkkkkkkkdo.",
        ".odklkllklllkdo.",
        ".odkkkkkkkkkkdo.",
        ".odklllkllkkkdo.",
        ".odkkkkkkkkkkdo.",
        ".oddddddddddddo.",
        ".oooooooooooooo.",
        "......omo.......",
        "....ommmmmo.....",
        "....ooooooo.....",
        "................",
    ]),
    # --- armor ---
    "hardened-kernel": (ENEMY_PALETTE, [
        "................",
        "..oooo....oooo..",
        ".ollllo..ollllo.",
        ".olmmmmoommmmlo.",
        ".olmmmmmmmmmmlo.",
        "..olmmkkkkmmlo..",
        "...olmkllkmlo...",
        "...olmkllkmlo...",
        "...olmkkkkmlo...",
        "...olmmmmmmlo...",
        "...odmmmmmmdo...",
        "...oddddddddo...",
        "....oooooooo....",
        "................",
        "................",
        "................",
    ]),
    "firewall-plating": (ENEMY_PALETTE, [
        "................",
        "..oooo....oooo..",
        ".ollllo..ollllo.",
        ".olmmmmoommmmlo.",
        ".oddddddddddddo.",
        "..olmmdmmmdmlo..",
        "...oddddddddo...",
        "...olmdmmmdlo...",
        "...oddddddddo...",
        "...oldmmmdmlo...",
        "...oddddddddo...",
        "...oddddddddo...",
        "....oooooooo....",
        "................",
        "................",
        "................",
    ]),
    "encrypted-shell": (ENEMY_PALETTE, [
        "................",
        "..oooo....oooo..",
        ".ollllo..ollllo.",
        ".olmmmmoommmmlo.",
        ".olmmmmmmmmmmlo.",
        "..olmmmkkmmmlo..",
        "...olmkmmkmlo...",
        "...olkkkkkklo...",
        "...olkklkkklo...",
        "...olkkkkkklo...",
        "...odmmmmmmdo...",
        "...oddddddddo...",
        "....oooooooo....",
        "................",
        "................",
        "................",
    ]),
    # --- modules ---
    "overclock-chip": (ENEMY_PALETTE, [
        "................",
        "...o.o.o.o.o....",
        "..ooooooooooo...",
        ".ooddddddddddoo.",
        "..odmmmmmmmmdo..",
        ".oodmmmmlmmmdoo.",
        "..odmmmllmmmdo..",
        ".oodmmllllmmdoo.",
        "..odmmmmllmmdo..",
        ".oodmmmmlmmmdoo.",
        "..odmmmmmmmmdo..",
        ".ooddddddddddoo.",
        "..ooooooooooo...",
        "...o.o.o.o.o....",
        "................",
        "................",
    ]),
    "cache-module": (ENEMY_PALETTE, [
        "................",
        "................",
        "................",
        "oooooooooooooooo",
        "ollllllllllllllo",
        "omkkmkkmkkmkkmmo",
        "omkkmkkmkkmkkmmo",
        "ommmmmmmmmmmmmmo",
        "oddddddddddddddo",
        "oooooooooooooooo",
        ".o.o.o.o.o.o.o..",
        "................",
        "................",
        "................",
        "................",
        "................",
    ]),
    "latency-buffer": (ENEMY_PALETTE, [
        "................",
        "...oooooooooo...",
        "...oddddddddo...",
        "....olllllllo...",
        "....olmmmmlo....",
        ".....olmmlo.....",
        "......olmo......",
        "......omlo......",
        ".....ommmmo.....",
        "....ommllmmo....",
        "....ommmmmmmo...",
        "...oddddddddo...",
        "...oooooooooo...",
        "................",
        "................",
        "................",
    ]),
    # --- legendaries (full color) ---
    "insight-lens": (LEGENDARY_PALETTE, [
        "................",
        ".....oooo.......",
        "....oyyyyo......",
        "...oybbbbyo.....",
        "..oybwbbbbyo....",
        "..oybbkkbbyo....",
        "..oybbkkbbyo....",
        "..oybbbbbbyo....",
        "...oybbbbyo.....",
        "....oyyyyYooo...",
        ".....oooo.oYYo..",
        "...........oYYo.",
        "............oYYo",
        ".............oo.",
        "................",
        "................",
    ]),
    "failover-core": (LEGENDARY_PALETTE, [
        "................",
        "..oooo....oooo..",
        ".oyyyyo..oyyyyo.",
        ".oyYYYYooYYYYyo.",
        ".oyYYYYYYYYYYyo.",
        "..oyYYobboYYyo..",
        "...oyYbwbbYyo...",
        "...oyYbbbbYyo...",
        "...oyYobboYyo...",
        "...oyYYYYYYyo...",
        "...oYYYYYYYYo...",
        "...oYYYYYYYYo...",
        "....oooooooo....",
        "................",
        "................",
        "................",
    ]),
    "elimination-engine": (LEGENDARY_PALETTE, [
        "................",
        "...o.o.o.o.o....",
        "..ooooooooooo...",
        ".ooYYYYYYYYYYoo.",
        "..oYyyyyyyyyYo..",
        ".ooYyrryyrryYoo.",
        "..oYyyrrrryyYo..",
        ".ooYyyyrryyyYoo.",
        "..oYyyrrrryyYo..",
        ".ooYyrryyrryYoo.",
        "..oYyyyyyyyyYo..",
        ".ooYYYYYYYYYYoo.",
        "..ooooooooooo...",
        "...o.o.o.o.o....",
        "................",
        "................",
    ]),
}

# ---------------------------------------------------------------
# Armor worn on the player
# Each overlay repaints one class's torso with an armor pattern, plus
# shoulder pads, so it fits that class's body exactly. Overlays are
# 2-frame sheets like the class sprites, so they bob along with them.
# ---------------------------------------------------------------

# Torso area of each class grid: (first row, last row, first col, last col)
TORSO = {
    "defender": (6, 11, 5, 8),
    "analyst": (7, 11, 3, 10),
    "cryptographer": (9, 12, 2, 10),
}

def armor_pixel(armor, row, col, top, bottom, left, right):
    """Which color an armor puts on one torso pixel."""
    middle = (left + right) // 2
    if armor == "hardened-kernel":
        if row == top:
            return "l"
        if row == bottom:
            return "d"
        return "k" if col in (middle, middle + 1) and row in (top + 2, top + 3) else "m"
    if armor == "firewall-plating":
        if (row - top) % 2 == 1:
            return "d"
        return "d" if (col + (row - top) // 2 * 2) % 4 == 0 else "m"
    if armor == "encrypted-shell":
        if row == top:
            return "l"
        return "d" if (row + col) % 2 == 0 else "m"  # a scaled shell pattern
    if armor == "failover-core":
        if row == bottom:
            return "Y"
        return "b" if col in (middle, middle + 1) and row in (top + 2, top + 3) else "y"
    raise ValueError(armor)

def make_armor_overlay(armor, class_id):
    _, class_rows = CLASSES[class_id]
    top, bottom, left, right = TORSO[class_id]
    palette = LEGENDARY_PALETTE if armor == "failover-core" else ENEMY_PALETTE
    grid = [["."] * SIZE for _ in range(SIZE)]
    for row in range(top, bottom + 1):
        for col in range(left, right + 1):
            if class_rows[row][col] in "aA":  # only the class's own clothing pixels
                grid[row][col] = armor_pixel(armor, row, col, top, bottom, left, right)
    # Shoulder pads just outside the top torso row
    filled = [col for col in range(SIZE) if grid[top][col] != "."]
    pad = "y" if armor == "failover-core" else "l"
    for col in (min(filled) - 1, max(filled) + 1):
        grid[top][col] = pad
        grid[top + 1][col] = "Y" if armor == "failover-core" else "m"
    frame = grid_to_image(["".join(row) for row in grid], palette, SIZE, SIZE)
    sheet = Image.new("RGBA", (SIZE * 2, SIZE), (0, 0, 0, 0))
    sheet.paste(frame, (0, 0))
    sheet.paste(frame.crop((0, 1, SIZE, SIZE)), (SIZE, 0))  # same bob as the body
    return sheet

ARMOR_ICONS = ["hardened-kernel", "firewall-plating", "encrypted-shell", "failover-core"]


# ---------------------------------------------------------------
# Area backgrounds (320x180, the size of the game screen)
# ---------------------------------------------------------------

W, H, FLOOR = 320, 180, 128

def gradient(draw, top, bottom, height=FLOOR):
    for y in range(height):
        t = y / height
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (W, y)], fill=color)

def stars(draw, rng, count, color, max_y):
    for _ in range(count):
        draw.point((rng.randrange(W), rng.randrange(max_y)), fill=color)

def floor_tiles(draw, base, line, step=16):
    draw.rectangle([0, FLOOR, W, H], fill=base)
    for x in range(0, W, step):
        draw.line([(x, FLOOR), (x, H)], fill=line)
    for y in range(FLOOR + step // 2, H, step // 2):
        draw.line([(0, y), (W, y)], fill=line)

def bg_foundry(rng):
    img = Image.new("RGB", (W, H)); d = ImageDraw.Draw(img)
    gradient(d, (26, 12, 8), (70, 30, 12))
    for x in range(0, W, 40):  # factory buildings with chimneys
        top = rng.randrange(60, 95)
        d.rectangle([x, top, x + 34, FLOOR], fill=(18, 10, 6))
        d.rectangle([x + 6, top - 30, x + 12, top], fill=(18, 10, 6))
        for wy in range(top + 8, FLOOR - 8, 12):  # glowing furnace windows
            for wx in (x + 6, x + 20):
                if rng.random() < 0.7:
                    d.rectangle([wx, wy, wx + 6, wy + 4], fill=(255, 140, 26) if rng.random() < 0.6 else (180, 70, 10))
    floor_tiles(d, (36, 22, 14), (24, 14, 9))
    return img

def bg_breach(rng):
    img = Image.new("RGB", (W, H)); d = ImageDraw.Draw(img)
    gradient(d, (18, 12, 34), (70, 24, 52))
    stars(d, rng, 40, (120, 90, 140), 60)
    points = [(0, FLOOR)] + [(x, rng.randrange(80, 115)) for x in range(0, W + 20, 20)] + [(W, FLOOR)]
    d.polygon(points, fill=(13, 8, 24))  # jagged ridges
    for x in (40, 150, 260):  # broken pylons
        d.rectangle([x, 70, x + 4, FLOOR], fill=(30, 18, 40))
        d.line([(x - 8, 78), (x + 12, 74)], fill=(30, 18, 40), width=2)
    d.rectangle([0, FLOOR, W, H], fill=(30, 20, 20))
    for _ in range(14):  # cracks in the ground
        x, y = rng.randrange(W), rng.randrange(FLOOR + 4, H)
        d.line([(x, y), (x + rng.randrange(-12, 12), y + rng.randrange(2, 8))], fill=(14, 9, 9))
    return img

def bg_citadel(rng):
    img = Image.new("RGB", (W, H)); d = ImageDraw.Draw(img)
    gradient(d, (7, 13, 31), (20, 37, 74))
    stars(d, rng, 60, (150, 170, 220), 50)
    d.rectangle([0, 60, W, FLOOR], fill=(10, 18, 38))  # castle wall
    for x in range(0, W, 16):  # crenellations
        d.rectangle([x, 52, x + 8, 60], fill=(10, 18, 38))
    for y in range(66, FLOOR, 8):  # bricks
        offset = 0 if (y // 8) % 2 else 8
        for x in range(offset, W, 16):
            d.line([(x, y), (x, y + 8)], fill=(16, 26, 52))
        d.line([(0, y), (W, y)], fill=(16, 26, 52))
    for x in (60, 160, 260):  # torches
        d.rectangle([x, 88, x + 2, 96], fill=(70, 50, 30))
        d.rectangle([x - 1, 84, x + 3, 88], fill=(255, 179, 71))
    floor_tiles(d, (26, 31, 46), (18, 22, 34))
    return img

def bg_ops(rng):
    img = Image.new("RGB", (W, H)); d = ImageDraw.Draw(img)
    gradient(d, (3, 18, 18), (8, 42, 42))
    for x in range(8, W, 36):  # server racks
        d.rectangle([x, 40, x + 26, FLOOR], fill=(4, 26, 26), outline=(12, 52, 52))
        for y in range(46, FLOOR - 4, 6):
            d.line([(x + 3, y), (x + 23, y)], fill=(10, 40, 40))
            if rng.random() < 0.5:  # blinking lights
                d.point((x + 20, y - 2), fill=(0, 255, 156) if rng.random() < 0.8 else (255, 56, 100))
    for _ in range(5):  # hanging cables
        x = rng.randrange(W)
        d.line([(x, 0), (x + rng.randrange(-20, 20), 38)], fill=(20, 60, 60))
    floor_tiles(d, (10, 31, 31), (6, 20, 20), step=8)
    return img

def bg_council(rng):
    img = Image.new("RGB", (W, H)); d = ImageDraw.Draw(img)
    gradient(d, (12, 8, 32), (42, 26, 74))
    for x in range(20, W, 70):  # tall pillars with gold caps
        d.rectangle([x, 20, x + 18, FLOOR], fill=(18, 12, 42))
        d.rectangle([x - 3, 16, x + 21, 22], fill=(199, 149, 44))
        d.rectangle([x - 3, FLOOR - 4, x + 21, FLOOR], fill=(120, 90, 30))
    for x in (55, 195):  # banners
        d.rectangle([x, 30, x + 14, 70], fill=(110, 30, 60))
        d.polygon([(x, 70), (x + 7, 64), (x + 14, 70)], fill=(42, 26, 74))
    d.rectangle([0, FLOOR, W, H], fill=(30, 26, 48))
    for x in range(0, W, 16):  # checkered marble floor
        for y in range(FLOOR, H, 8):
            if (x // 16 + y // 8) % 2:
                d.rectangle([x, y, x + 15, y + 7], fill=(40, 34, 64))
    return img

BACKGROUNDS = {
    "foundry": bg_foundry, "breach-wastes": bg_breach, "citadel": bg_citadel,
    "operations-deep": bg_ops, "council-spire": bg_council,
}


def main():
    out = ROOT / "assets"
    (out / "sprites" / "classes").mkdir(parents=True, exist_ok=True)
    (out / "sprites" / "enemies").mkdir(parents=True, exist_ok=True)
    (out / "backgrounds").mkdir(parents=True, exist_ok=True)

    for name, (palette, rows) in CLASSES.items():
        make_sheet(rows, palette).save(out / "sprites" / "classes" / f"{name}.png")
    for name, rows in ENEMIES.items():
        make_sheet(rows, ENEMY_PALETTE).save(out / "sprites" / "enemies" / f"{name}.png")
    palette, rows = CROWN
    grid_to_image(rows, palette, 10, 5).save(out / "sprites" / "crown.png")
    for name, painter in BACKGROUNDS.items():
        painter(random.Random(name)).save(out / "backgrounds" / f"{name}.png")

    (out / "sprites" / "items").mkdir(parents=True, exist_ok=True)
    for name, (item_palette, rows) in ITEMS.items():
        grid_to_image(rows, item_palette, SIZE, SIZE).save(out / "sprites" / "items" / f"{name}.png")

    (out / "sprites" / "armor").mkdir(parents=True, exist_ok=True)
    for armor in ARMOR_ICONS:
        for class_id in CLASSES:
            make_armor_overlay(armor, class_id).save(out / "sprites" / "armor" / f"{armor}-{class_id}.png")

    print(f"Saved {len(CLASSES)} class sprites, {len(ENEMIES)} enemy sprites, 1 crown, {len(BACKGROUNDS)} backgrounds,")
    print(f"      {len(ITEMS)} item icons and {len(ARMOR_ICONS) * len(CLASSES)} armor overlays.")


if __name__ == "__main__":
    main()
