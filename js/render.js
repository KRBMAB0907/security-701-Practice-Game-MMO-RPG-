// Drawing the canvas and the game loop that animates it.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function drawHealthBar(fighter) {
  const width = 48;
  const x = fighter.x + 8 - width / 2;  // centred over the 16px fighter
  const y = fighter.y - 24;
  const fill = Math.max(fighter.hp, 0) / fighter.maxHp;

  ctx.fillStyle = "#1c2733";
  ctx.fillRect(x, y, width, 5);
  ctx.fillStyle = fill > 0.3 ? "#00ff9c" : "#ff3864";  // red when low
  ctx.fillRect(x, y, Math.round(width * fill), 5);

  ctx.fillStyle = "#d8f3e8";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillText(Math.max(fighter.hp, 0) + "/" + fighter.maxHp, fighter.x + 8, y - 3);
}

function drawFighter(fighter, size) {
  // A shake moves the fighter a random 1-2 pixels each frame
  const offset = fighter.shake > 0 ? Math.round(Math.random() * 4 - 2) : 0;
  ctx.fillStyle = fighter.flash > 0 ? "#ffffff" : fighter.color;
  // Bigger fighters stand on the same floor line
  ctx.fillRect(fighter.x + offset - (size - 16) / 2, fighter.y + 16 - size, size, size);
}

function drawXpBar() {
  const x = 8, y = 166, width = canvas.width - 16;
  const fill = save.xp / xpToNextLevel();
  ctx.fillStyle = "#1c2733";
  ctx.fillRect(x, y, width, 3);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x, y, Math.round(width * fill), 3);

  ctx.font = "8px monospace";
  ctx.textAlign = "left";
  ctx.fillText("Lv " + save.level + "  XP " + save.xp + "/" + xpToNextLevel(), x, y - 4);
}

function draw() {
  // Background and floor
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1c2733";
  ctx.fillRect(0, 128, canvas.width, 2);

  ctx.font = "8px monospace";
  ctx.fillStyle = "#d8f3e8";

  if (currentZone && enemy.maxHp > 0) {
    // Zone name and progress across the top
    ctx.textAlign = "center";
    ctx.fillStyle = "#7fa894";
    ctx.fillText(currentZone.name + "  " + (enemyIndex + 1) + "/" + currentZone.enemies.length, canvas.width / 2, 14);

    ctx.fillStyle = "#d8f3e8";
    ctx.textAlign = "left";
    ctx.fillText(player.name, 8, 28);
    ctx.textAlign = "right";
    ctx.fillStyle = enemy.boss ? "#ffd166" : "#d8f3e8";
    ctx.fillText(enemy.name, canvas.width - 8, 28);

    drawFighter(player, 16);
    drawFighter(enemy, enemy.boss ? 24 : 16);
    drawHealthBar(player);
    drawHealthBar(enemy);
  }

  if (currentMode) {
    drawXpBar();
  }

  // Floating damage numbers
  ctx.textAlign = "center";
  floatingTexts.forEach(text => {
    ctx.globalAlpha = Math.max(text.life / text.maxLife, 0);
    ctx.fillStyle = text.color;
    ctx.fillText(text.value, text.x, text.y);
  });
  ctx.globalAlpha = 1;
}

// Move the animations forward by dt milliseconds
function update(dt) {
  [player, enemy].forEach(fighter => {
    fighter.flash = Math.max(fighter.flash - dt, 0);
    fighter.shake = Math.max(fighter.shake - dt, 0);
  });

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
