// Sprites: loading the pixel art, tinting enemies, and drawing frames.
// Art lives in assets/ and is made by tools/make_sprites.py (or by hand in Piskel).
// Every sprite file is a sheet of 2 frames, each SPRITE_SIZE pixels square.
// If an image is missing or fails to load, the game draws a colored square instead.

const SPRITE_SIZE = 16;
const FRAME_MS = 400;  // how long each idle animation frame shows

const images = {};      // file path -> Image (only once it has loaded)
const tintCache = {};   // "path|color" -> canvas with the tinted sheet

// Start loading an image. It shows up in `images` when ready; until then,
// or if it fails, getImage returns null and the caller uses its fallback.
function loadImage(path) {
  if (path in images || path in loadImage.pending) {
    return;
  }
  loadImage.pending[path] = true;
  const image = new Image();
  image.onload = () => { images[path] = image; };
  image.onerror = () => console.warn("Missing image, using fallback:", path);
  image.src = path;
}
loadImage.pending = {};

function getImage(path) {
  return images[path] || null;
}

function classSpritePath(classId) {
  return "assets/sprites/classes/" + classId + ".png";
}

function enemySpritePath(spriteName) {
  return "assets/sprites/enemies/" + spriteName + ".png";
}

function backgroundPath(areaId) {
  return "assets/backgrounds/" + areaId + ".png";
}

// Queue up every image the game might need
function preloadArt() {
  classes.forEach(playerClass => loadImage(classSpritePath(playerClass.id)));
  enemyTypes.forEach(type => {
    if (type.sprite) {
      loadImage(enemySpritePath(type.sprite));
    }
  });
  areas.forEach(area => loadImage(backgroundPath(area.id)));
  loadImage("assets/sprites/crown.png");
}

// Recolor a grayscale sheet. "multiply" keeps the shading: light grays
// become bright versions of the color, dark grays become shadows.
// "destination-in" then trims the color back to the sprite's own shape.
function tinted(path, color) {
  const key = path + "|" + color;
  if (!(key in tintCache)) {
    const image = getImage(path);
    if (image === null) {
      return null;
    }
    const sheet = document.createElement("canvas");
    sheet.width = image.width;
    sheet.height = image.height;
    const sheetCtx = sheet.getContext("2d");
    sheetCtx.drawImage(image, 0, 0);
    sheetCtx.globalCompositeOperation = "multiply";
    sheetCtx.fillStyle = color;
    sheetCtx.fillRect(0, 0, sheet.width, sheet.height);
    sheetCtx.globalCompositeOperation = "destination-in";
    sheetCtx.drawImage(image, 0, 0);
    tintCache[key] = sheet;
  }
  return tintCache[key];
}

// A solid white copy of the sprite's shape, for the hit flash
function silhouette(path) {
  const key = path + "|flash";
  if (!(key in tintCache)) {
    const image = getImage(path);
    if (image === null) {
      return null;
    }
    const sheet = document.createElement("canvas");
    sheet.width = image.width;
    sheet.height = image.height;
    const sheetCtx = sheet.getContext("2d");
    sheetCtx.drawImage(image, 0, 0);
    sheetCtx.globalCompositeOperation = "source-in";
    sheetCtx.fillStyle = "#ffffff";
    sheetCtx.fillRect(0, 0, sheet.width, sheet.height);
    tintCache[key] = sheet;
  }
  return tintCache[key];
}

// Which animation frame to show right now (0 or 1)
function idleFrame(time) {
  return Math.floor(time / FRAME_MS) % 2;
}

// Draw one frame of a sheet at (x, y), scaled to `size` pixels.
// flip = true mirrors it, so enemies face left toward the player.
function drawFrame(sheet, frame, x, y, size, flip) {
  ctx.imageSmoothingEnabled = false;  // keep pixels crisp when scaled up
  ctx.save();
  if (flip) {
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }
  ctx.drawImage(sheet, frame * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE, x, y, size, size);
  ctx.restore();
}
