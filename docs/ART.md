# Editing the pixel art

All the art is plain PNG files, so you can redraw anything in [Piskel](https://www.piskelapp.com) (free, runs in the browser) or any pixel editor.

## Where everything lives

| What | File | Size |
| --- | --- | --- |
| Player classes | `assets/sprites/classes/<class id>.png` | 32x16 (2 frames) |
| Enemy bodies | `assets/sprites/enemies/<body>.png` | 32x16 (2 frames) |
| Boss crown | `assets/sprites/crown.png` | 10x5 |
| Area scenes | `assets/backgrounds/<area id>.png` | 320x180 |

**Sprite sheets have 2 frames side by side,** each 16x16 pixels. The game swaps between them every 0.4 seconds for the idle animation. Frame 2 is usually the same drawing raised by 1 pixel, so the character bobs.

## Rules for enemy sprites

Enemy sprites are **grayscale**. The game multiplies each pixel by the enemy's `color` (set in `data/areas/*.json`), so one drawing makes many different-looking enemies:

- **White and light grays** become bright versions of the enemy's color.
- **Dark grays** become shadows of that color.
- **Black** stays black, which is good for outlines and eyes.
- Any real color you use gets mixed with the tint, so stick to grays.

Class sprites and backgrounds are **not tinted**, so use any colors you like.

Draw everything **facing right**. The game flips enemies so they face the player.

## Editing a sprite in Piskel

1. Open piskelapp.com and click **Create Sprite**.
2. Open the menu with the folder icon (Import), choose your PNG, and pick **Import as spritesheet** with a frame size of **16 x 16**. You'll get 2 frames.
3. Draw. Keep the feet on the bottom row of the frame, since that's where the floor is.
4. Export with **Export → PNG → Spritesheet**, as 2 columns in 1 row, and save it over the old file with the same name.
5. Refresh the game (with `python -m http.server 8000` running) to see it.

## Adding a new enemy body

1. Draw a new grayscale sheet and save it as `assets/sprites/enemies/<name>.png`.
2. Set `"sprite": "<name>"` on any enemy in `data/areas/*.json`.
3. Run `python tools/check_game_data.py`. It reports any enemy whose sprite file is missing.

If a sprite is missing or broken, the game still works: it draws a colored square instead.

## Regenerating the starter art

`tools/make_sprites.py` drew the original art from text grids, where each letter is a pixel color. You can edit a grid there and run `python tools/make_sprites.py`.

**Warning:** that script overwrites every PNG it makes. If you've edited sprites in Piskel, back them up first.
