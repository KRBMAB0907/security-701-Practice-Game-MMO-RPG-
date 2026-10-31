// Drawing the canvas and the game loop that animates it.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// The game is designed in "game units": a 320x180 screen. Everything is
// positioned in those units. The canvas itself is drawn at the real size
// it appears on screen, and renderScale converts game units to real pixels.
// Result: crisp, smooth text, while sprites are still scaled up as chunky
// pixels on purpose (image smoothing off) for the retro look.
const GAME_W = 320;
const GAME_H = 180;
const FONT = "8px monospace";  // 8 game units tall, drawn sharp at any size
const SPEECH_FONT = "7px monospace";
let renderScale = 1;

function resizeCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;  // 2 on Retina screens
  const width = Math.max(GAME_W, Math.round(canvas.clientWidth * pixelRatio));
  canvas.width = width;
  canvas.height = Math.round(width * GAME_H / GAME_W);
  renderScale = canvas.width / GAME_W;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
// Also catch size changes the window "resize" event misses, like turning a
// phone or the layout switching between stacked and side by side
if (window.ResizeObserver) {
  new ResizeObserver(resizeCanvas).observe(canvas);
}

const FLOOR_Y = 128;      // where fighters stand
const BOSS_SIZE = 32;     // bosses are drawn at 2x (16px art x 2 stays crisp)
let animationTime = 0;    // total milliseconds, drives the idle animation

// Text with a 1px dark shadow, so it stays readable over the backgrounds
function shadowText(text, x, y, color) {
  ctx.fillStyle = "#05070a";
  ctx.fillText(text, x + 0.6, y + 0.6);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Top edge of a fighter drawn at this size (everyone stands on the floor)
function fighterTop(fighter, size) {
  return fighter.y + 16 - size;
}

function drawHealthBar(fighter, size) {
  const width = 48;
  const x = fighter.x + 8 - width / 2;  // centred over the fighter
  const y = fighterTop(fighter, size) - (fighter.boss ? 18 : 12);  // bosses leave room for the crown
  const fill = Math.max(fighter.hp, 0) / fighter.maxHp;

  ctx.fillStyle = "#05070a";
  ctx.fillRect(x - 1, y - 1, width + 2, 7);
  ctx.fillStyle = "#1c2733";
  ctx.fillRect(x, y, width, 5);
  ctx.fillStyle = fill > 0.3 ? "#00ff9c" : "#ff3864";  // red when low
  ctx.fillRect(x, y, Math.round(width * fill), 5);

  ctx.font = FONT;
  ctx.textAlign = "center";
  shadowText(Math.max(fighter.hp, 0) + "/" + fighter.maxHp, fighter.x + 8, y - 3, "#d8f3e8");
}

// The sheet to draw for a fighter, or null if its image isn't loaded
function fighterSheet(fighter) {
  if (fighter.spritePath === null) {
    return null;
  }
  if (fighter.flash > 0) {
    return silhouette(fighter.spritePath);  // white hit flash
  }
  return fighter.tint ? tinted(fighter.spritePath, fighter.color) : getImage(fighter.spritePath);
}

// A smooth "out and back" movement: 0 at the start and end, 1 in the middle.
// When the countdown is finished (timeLeft is 0) it returns 0, so no movement.
function bounce(timeLeft, totalTime) {
  return timeLeft > 0 ? Math.sin((1 - timeLeft / totalTime) * Math.PI) : 0;
}

function drawFighter(fighter, size, flip) {
  // A shake moves the fighter a random 1-2 pixels each frame
  let offset = fighter.shake > 0 ? Math.round(Math.random() * 4 - 2) : 0;
  // Lunging moves toward the other fighter; dodging hops back (flip = facing left)
  const toward = flip ? -1 : 1;
  offset += Math.round(toward * 12 * bounce(fighter.lunge, LUNGE_MS));
  offset -= Math.round(toward * 8 * bounce(fighter.dodge, DODGE_MS));
  const x = fighter.x + offset - (size - 16) / 2;
  const y = fighterTop(fighter, size);

  const sheet = fighterSheet(fighter);
  if (sheet === null) {
    // Fallback: the original colored square, used while images load or if one is missing
    ctx.fillStyle = fighter.flash > 0 ? "#ffffff" : fighter.color;
    ctx.fillRect(x, y, size, size);
  } else {
    const frame = idleFrame(animationTime);
    drawFrame(sheet, frame, x, y, size, flip);
    // The player's equipped armor, drawn over the body on the same frame
    if (fighter === player) {
      const armor = armorSheet(fighter.flash > 0);
      if (armor !== null) {
        drawFrame(armor, frame, x, y, size, flip);
      }
    }
  }

  // Bosses wear a crown, centred above their head
  const crown = getImage("assets/sprites/crown.png");
  if (fighter.boss && crown !== null) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(crown, fighter.x + 8 - crown.width, y - crown.height * 2 + 2, crown.width * 2, crown.height * 2);
  }
}

// The area scene behind everything; plain colors if the image isn't ready
function drawBackground() {
  const area = currentZone ? areaOf(currentZone) : selectedArea;
  let background = area ? getImage(backgroundPath(area.id)) : null;
  if (isCampOpen()) {
    background = getImage(backgroundPath("camp"));
  }

  if (background !== null) {
    ctx.drawImage(background, 0, 0, GAME_W, GAME_H);
  } else {
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.fillStyle = "#1c2733";
    ctx.fillRect(0, FLOOR_Y, GAME_W, 2);
  }
}

// Break text into lines that fit `maxWidth` game units
function wrapText(text, maxWidth) {
  const lines = [];
  let line = "";
  text.split(" ").forEach(word => {
    const attempt = line ? line + " " + word : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  });
  lines.push(line);
  return lines;
}

// The enemy's speech bubble, above its health bar, fading out at the end
function drawSpeechBubble(size) {
  if (speech === null || enemy.maxHp === 0) {
    return;
  }
  ctx.font = SPEECH_FONT;
  const lines = wrapText(speech.text, 104);
  const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + 10;
  const height = lines.length * 9 + 6;
  const tailX = enemy.x + 8;
  const x = Math.min(Math.max(tailX - width / 2, 4), GAME_W - width - 4);  // stay on screen
  const y = fighterTop(enemy, size) - (enemy.boss ? 18 : 12) - 20 - height;  // clear of the health number

  ctx.globalAlpha = Math.min(1, speech.life / 300);  // fade out over the last 0.3s
  ctx.fillStyle = "#05070a";
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);  // dark outline
  ctx.fillStyle = "#f4f1e8";
  ctx.fillRect(x, y, width, height);
  ctx.beginPath();  // the tail pointing down at the enemy
  ctx.moveTo(tailX - 4, y + height);
  ctx.lineTo(tailX + 4, y + height);
  ctx.lineTo(tailX, y + height + 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#05070a";
  ctx.textAlign = "left";
  lines.forEach((line, i) => ctx.fillText(line, x + 5, y + 9 + i * 9));
  ctx.globalAlpha = 1;
  ctx.font = FONT;
}

function drawXpBar() {
  const x = 8, y = 166, width = GAME_W - 16;
  const fill = save.xp / xpToNextLevel();
  ctx.fillStyle = "#05070a";
  ctx.fillRect(x - 1, y - 1, width + 2, 5);
  ctx.fillStyle = "#1c2733";
  ctx.fillRect(x, y, width, 3);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x, y, Math.round(width * fill), 3);

  ctx.font = FONT;
  ctx.textAlign = "left";
  shadowText("Lv " + save.level + "  XP " + save.xp + "/" + xpToNextLevel(), x, y - 4, "#ffd166");
}

function isCampOpen() {
  return !document.getElementById("camp-panel").hidden;
}

function draw() {
  // Work in game units: scale everything up to the canvas's real size
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;  // pixel art stays sharp and blocky
  drawBackground();
  ctx.font = FONT;

  if (currentZone && enemy.maxHp > 0) {
    // Zone name and progress across the top
    ctx.textAlign = "center";
    shadowText(currentZone.name + "  " + (enemyIndex + 1) + "/" + currentZone.enemies.length, GAME_W / 2, 14, "#a8d5c0");

    ctx.textAlign = "left";
    shadowText(player.name, 8, 28, "#d8f3e8");
    ctx.textAlign = "right";
    shadowText(enemy.name, GAME_W - 8, 28, enemy.boss ? "#ffd166" : "#d8f3e8");
    if (enemy.phases) {
      shadowText("Phase " + (currentPhase() + 1) + "/" + enemy.phases.length, GAME_W - 8, 40, "#a8d5c0");
    }

    const enemySize = enemy.boss ? BOSS_SIZE : 16;
    drawFighter(player, 16, false);
    drawFighter(enemy, enemySize, true);  // enemies face left, toward the player
    drawHealthBar(player, 16);
    drawHealthBar(enemy, enemySize);
    drawSpeechBubble(enemySize);
  }

  if (isCampOpen()) {
    drawCamp();  // in camp.js
  }

  if (currentMode) {
    drawXpBar();
  }

  // Floating damage numbers
  ctx.textAlign = "center";
  floatingTexts.forEach(text => {
    ctx.globalAlpha = Math.max(text.life / text.maxLife, 0);
    shadowText(text.value, text.x, text.y, text.color);
  });
  ctx.globalAlpha = 1;

  // The character on the Gear screen animates too
  if (!document.getElementById("gear-panel").hidden) {
    drawPaperDoll();
  }
}

// Move the animations forward by dt milliseconds
function update(dt) {
  animationTime += dt;
  [player, enemy].forEach(fighter => {
    fighter.flash = Math.max(fighter.flash - dt, 0);
    fighter.shake = Math.max(fighter.shake - dt, 0);
    fighter.lunge = Math.max(fighter.lunge - dt, 0);
    fighter.dodge = Math.max(fighter.dodge - dt, 0);
  });

  if (speech !== null) {
    speech.life -= dt;
    if (speech.life <= 0) {
      speech = null;
    }
  }

  floatingTexts.forEach(text => {
    text.life -= dt;
    text.y -= dt * 0.02;  // drift upward
  });
  floatingTexts = floatingTexts.filter(text => text.life > 0);
}

// The game loop: the browser calls this about 60 times a second.
// Each time we update the animations, then redraw the whole screen.
let lastTime = 0;
function gameLoop(time) {
  const dt = Math.min(time - lastTime, 100);  // cap big jumps (e.g. after switching tabs)
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}
