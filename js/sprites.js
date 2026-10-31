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

function itemIconPath(iconId) {
  return "assets/sprites/items/" + iconId + ".png";
}

// Armor drawn on top of a class sprite, e.g. firewall-plating-defender.png
function armorOverlayPath(iconId, classId) {
  return "assets/sprites/armor/" + iconId + "-" + classId + ".png";
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
  loadImage(backgroundPath("camp"));
  campData.npcs.forEach(npc => loadImage(npcSpritePath(npc.id)));
  loadImage("assets/sprites/crown.png");

  const itemTypes = [...lootTable.bases, ...lootTable.legendaries];
  itemTypes.forEach(type => {
    loadImage(itemIconPath(type.icon));
    if (type.slot === "armor") {
      classes.forEach(playerClass => loadImage(armorOverlayPath(type.icon, playerClass.id)));
    }
  });
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
// target is the canvas context to draw on (the game screen by default).
function drawFrame(sheet, frame, x, y, size, flip, target = ctx) {
  target.imageSmoothingEnabled = false;  // keep pixels crisp when scaled up
  target.save();
  if (flip) {
    target.translate(x + size, y);
    target.scale(-1, 1);
    x = 0;
    y = 0;
  }
  target.drawImage(sheet, frame * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE, x, y, size, size);
  target.restore();
}

// ---------------------------------------------------------------
// Gear art: item icons and armor worn on the player
// ---------------------------------------------------------------

// Which icon an item uses. Items saved before icons existed don't have
// one, so they're matched to their type by name ("Rare Port Scanner").
function itemIcon(item) {
  if (item.icon) {
    return item.icon;
  }
  const type = [...lootTable.bases, ...lootTable.legendaries].find(t => item.name.endsWith(t.name));
  return type ? type.icon : null;
}

// Regular items are grayscale art tinted by tier; legendaries have their own colors
function gearImage(path, item) {
  return item.tier === "legendary" ? getImage(path) : tinted(path, tierById(item.tier).color);
}

// A small canvas showing an item's icon, for the gear screen and loot messages.
// Pass null for an empty slot.
function makeIconCanvas(item, cssSize) {
  const icon = document.createElement("canvas");
  icon.width = SPRITE_SIZE;
  icon.height = SPRITE_SIZE;
  icon.className = "item-icon";
  icon.style.width = cssSize + "px";
  icon.style.height = cssSize + "px";
  if (item === null) {
    return icon;  // empty slot: just the frame
  }
  icon.style.borderColor = tierById(item.tier).color;

  const iconCtx = icon.getContext("2d");
  const iconId = itemIcon(item);
  const image = iconId ? gearImage(itemIconPath(iconId), item) : null;
  if (image !== null) {
    iconCtx.drawImage(image, 0, 0);
  } else {
    iconCtx.fillStyle = tierById(item.tier).color;  // fallback: a colored square
    iconCtx.fillRect(4, 4, 8, 8);
  }
  return icon;
}

// The player's equipped armor, if it's active (your level is high enough)
function wornArmor() {
  const armor = findItem(save.equipped.armor);
  return armor !== undefined && armor.level <= save.level ? armor : null;
}

// The armor overlay sheet to draw over the player, or null for none.
// flash = true gives a white version for the hit flash.
function armorSheet(flash) {
  const armor = wornArmor();
  if (armor === null || currentClass() === undefined) {
    return null;
  }
  const path = armorOverlayPath(itemIcon(armor), currentClass().id);
  return flash ? silhouette(path) : gearImage(path, armor);
}
