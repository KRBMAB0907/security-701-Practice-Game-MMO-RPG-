const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------------------------------------------------------------
// Difficulty modes: every mode setting lives here, in one place.
//   time         seconds per question (null = no timer)
//   playerHp     your starting health at level 1
//   enemyHpScale multiplies every enemy's health (0.75 = 25% less)
//   enemyDamage  how hard enemies hit when you miss
// ---------------------------------------------------------------
const MODES = {
  fun:     { label: "Fun",     time: null, playerHp: 100, enemyHpScale: 0.75, enemyDamage: 10 },
  learner: { label: "Learner", time: 60,   playerHp: 100, enemyHpScale: 1,    enemyDamage: 15 },
  hard:    { label: "Hard",    time: 30,   playerHp: 80,  enemyHpScale: 1,    enemyDamage: 25 }
};

// ---------------------------------------------------------------
// Balance settings: the numbers to tweak if the game feels off.
// ---------------------------------------------------------------
const LOW_TIME_WARNING = 10;      // seconds left when the timer bar turns red
const WEAKNESS_MULTIPLIER = 1.5;  // damage bonus for hitting a weak point
const DAMAGE_PER_LEVEL = 0.1;     // +10% skill damage per level above 1
const HP_PER_LEVEL = 10;          // extra max health per level
const XP_PER_LEVEL = 50;          // level N needs N x 50 XP to level up
const DEATH_XP_LOSS = 0.25;       // dying costs 25% of the current XP bar
const SAVE_KEY = "secplus-rpg-save";

// Animation timings (milliseconds)
const FLASH_MS = 150;
const SHAKE_MS = 300;

// Readable names for question topics
const TOPIC_NAMES = {
  "control-categories": "control categories",
  "control-types": "control types"
};

// Loaded from the data files
let questions = [];
let skills = [];
let enemyTypes = [];
let zones = [];

// Saved progress (kept in the browser between visits)
let save = { level: 1, xp: 0, clearedZones: [] };

// Current game state
let currentMode = null;
let currentZone = null;
let enemyIndex = 0;       // which enemy in the zone we're fighting
let currentSkill = null;
let lastQuestionId = null;
let fightOver = false;
let fightWon = false;
let timerId = null;
let timeLeft = 0;

// The two fighters. flash and shake count down in milliseconds.
const player = { name: "You", hp: 100, maxHp: 100, x: 48,  y: 112, color: "#00ff9c", flash: 0, shake: 0 };
const enemy  = { name: "",    hp: 0,   maxHp: 0,   x: 256, y: 112, color: "#ff3864", flash: 0, shake: 0 };

// Damage numbers that float up and fade out
let floatingTexts = [];

// ===============================================================
// Loading data and saving progress
// ===============================================================

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("Could not load " + path);
  }
  return response.json();
}

// localStorage keeps small bits of text in the browser, even after
// the tab closes. It can fail (e.g. private browsing), so we use
// try/catch and simply play without saving if it does.
function loadSave() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text) {
      save = { ...save, ...JSON.parse(text) };
    }
  } catch (error) {
    console.warn("Could not load saved progress", error);
  }
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn("Could not save progress", error);
  }
}

// ===============================================================
// Leveling
// ===============================================================

function xpToNextLevel() {
  return save.level * XP_PER_LEVEL;
}

function playerMaxHp() {
  return currentMode.playerHp + (save.level - 1) * HP_PER_LEVEL;
}

// Returns a message if the player leveled up, otherwise ""
function gainXp(amount) {
  save.xp += amount;
  let message = "";
  while (save.xp >= xpToNextLevel()) {
    save.xp -= xpToNextLevel();
    save.level++;
    message = " LEVEL UP! You are now level " + save.level + ".";
  }
  writeSave();
  return message;
}

// Lose part of the current XP bar, but never a level
function loseXp() {
  const loss = Math.round(xpToNextLevel() * DEATH_XP_LOSS);
  const actualLoss = Math.min(loss, save.xp);
  save.xp -= actualLoss;
  writeSave();
  return actualLoss;
}

// ===============================================================
// Drawing (the canvas)
// ===============================================================

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

// ===============================================================
// Screens: only one panel shows at a time
// ===============================================================

function showPanel(id) {
  ["mode-panel", "map-panel", "battle-panel"].forEach(panelId => {
    document.getElementById(panelId).hidden = panelId !== id;
  });
}

// ===============================================================
// The map: sub-zones and unlocking
// ===============================================================

// A zone is unlocked if it's the first one, or the one before it is cleared
function isUnlocked(index) {
  return index === 0 || save.clearedZones.includes(zones[index - 1].id);
}

function showMap() {
  stopTimer();
  currentZone = null;
  enemy.maxHp = 0;
  showPanel("map-panel");

  document.getElementById("player-summary").textContent =
    "Level " + save.level + " · XP " + save.xp + "/" + xpToNextLevel() + " · Mode: " + currentMode.label;

  const list = document.getElementById("zone-list");
  list.innerHTML = "";

  zones.forEach((zone, index) => {
    const button = document.createElement("button");
    let status = "";

    if (!isUnlocked(index)) {
      status = "[locked]";
      button.disabled = true;
    } else if (zone.enemies.length === 0) {
      status = "[coming soon]";
      button.disabled = true;
    } else if (save.clearedZones.includes(zone.id)) {
      status = "[cleared - replay]";
    }

    button.textContent = zone.name + " (objective " + zone.objective + ") " + status;
    button.addEventListener("click", () => enterZone(zone));
    list.appendChild(button);
  });
}

function enterZone(zone) {
  currentZone = zone;
  enemyIndex = 0;
  showPanel("battle-panel");
  startFight();
}

document.getElementById("change-mode-button").addEventListener("click", () => {
  showPanel("mode-panel");
});

document.getElementById("reset-button").addEventListener("click", () => {
  if (confirm("Reset your level, XP and cleared zones?")) {
    save = { level: 1, xp: 0, clearedZones: [] };
    writeSave();
    showMap();
  }
});

// ===============================================================
// Combat
// ===============================================================

// Bosses change weakness at half health (their "phases")
function currentWeakness() {
  if (enemy.phases) {
    return enemy.hp > enemy.maxHp / 2 ? enemy.phases[0] : enemy.phases[1];
  }
  return enemy.weakness;
}

function skillDamage(skill) {
  let damage = skill.damage * (1 + (save.level - 1) * DAMAGE_PER_LEVEL);
  if (skill.topic === currentWeakness()) {
    damage *= WEAKNESS_MULTIPLIER;
  }
  return Math.round(damage);
}

function enemyDamage() {
  return Math.round(currentMode.enemyDamage * (enemy.damageScale || 1));
}

function hit(fighter, amount, color) {
  fighter.hp = Math.max(fighter.hp - amount, 0);
  fighter.flash = FLASH_MS;
  fighter.shake = SHAKE_MS;
  floatingTexts.push({ value: "-" + amount, x: fighter.x + 8, y: fighter.y - 34, color: color, life: 900, maxLife: 900 });
}

function startFight() {
  const enemyId = currentZone.enemies[enemyIndex];
  const type = enemyTypes.find(e => e.id === enemyId);

  enemy.name = type.name;
  enemy.color = type.color;
  enemy.boss = type.boss || false;
  enemy.weakness = type.weakness;
  enemy.phases = type.phases;
  enemy.damageScale = type.damageScale;
  enemy.xp = type.xp;
  enemy.maxHp = Math.round(type.hp * currentMode.enemyHpScale);
  enemy.hp = enemy.maxHp;

  // You start every fight at full health
  player.maxHp = playerMaxHp();
  player.hp = player.maxHp;

  fightOver = false;
  fightWon = false;
  floatingTexts = [];
  document.getElementById("mode-label").textContent = "Mode: " + currentMode.label;

  const intro = enemy.boss ? "BOSS: " + enemy.name + " blocks the way!" : "A " + enemy.name + " appears!";
  setLog(intro + " Weak to " + TOPIC_NAMES[currentWeakness()] + ".");
  showSkillChoice();
}

function setLog(message) {
  document.getElementById("battle-log").textContent = message;
}

function showSkillChoice() {
  document.getElementById("question-area").hidden = true;
  document.getElementById("next-button").hidden = true;
  document.getElementById("map-button").hidden = true;

  const skillsDiv = document.getElementById("skills");
  skillsDiv.innerHTML = "";
  skillsDiv.hidden = false;

  skills.forEach(skill => {
    const button = document.createElement("button");
    const weakPoint = skill.topic === currentWeakness();
    button.textContent = skill.name + " (" + skillDamage(skill) + " damage)" + (weakPoint ? " - WEAK POINT!" : "");
    button.classList.toggle("weak-point", weakPoint);

    const details = document.createElement("small");
    details.textContent = skill.description;
    button.appendChild(details);

    button.addEventListener("click", () => useSkill(skill));
    skillsDiv.appendChild(button);
  });
}

function useSkill(skill) {
  currentSkill = skill;
  document.getElementById("skills").hidden = true;
  setLog("You ready " + skill.name + "...");
  showQuestion(pickQuestion(skill.topic));
}

// A random question on the skill's topic, avoiding an instant repeat
function pickQuestion(topic) {
  let pool = questions.filter(q => q.topic === topic && q.id !== lastQuestionId);
  if (pool.length === 0) {
    pool = questions.filter(q => q.topic === topic);
  }
  const question = pool[Math.floor(Math.random() * pool.length)];
  lastQuestionId = question.id;
  return question;
}

// Called after a correct answer
function playerAttacks() {
  const weaknessBefore = currentWeakness();
  const damage = skillDamage(currentSkill);
  hit(enemy, damage, "#00ff9c");

  let message = currentSkill.name + " hits for " + damage + " damage!";
  if (enemy.hp > 0 && currentWeakness() !== weaknessBefore) {
    message += " The " + enemy.name + " shifts! Now weak to " + TOPIC_NAMES[currentWeakness()] + ".";
  }
  setLog(message);
}

// Called after a wrong answer or timeout
function enemyAttacks() {
  const damage = enemyDamage();
  hit(player, damage, "#ff3864");
  setLog(currentSkill.name + " fizzles! The " + enemy.name + " hits you for " + damage + ".");
}

function winFight() {
  fightOver = true;
  fightWon = true;
  const levelUp = gainXp(enemy.xp);
  const isLastEnemy = enemyIndex === currentZone.enemies.length - 1;
  const nextButton = document.getElementById("next-button");

  if (isLastEnemy) {
    if (!save.clearedZones.includes(currentZone.id)) {
      save.clearedZones.push(currentZone.id);
      writeSave();
    }
    setLog(currentZone.name + " cleared! +" + enemy.xp + " XP." + levelUp + " The next sub-zone is unlocked.");
    nextButton.hidden = true;
  } else {
    setLog("Victory! +" + enemy.xp + " XP." + levelUp);
    nextButton.textContent = "Next enemy";
    nextButton.hidden = false;
  }
  document.getElementById("map-button").hidden = false;
}

function loseFight() {
  fightOver = true;
  fightWon = false;
  const lost = loseXp();
  setLog("Defeated! You lost " + lost + " XP. Review the explanation and try again.");

  const nextButton = document.getElementById("next-button");
  nextButton.textContent = "Try again";
  nextButton.hidden = false;
  document.getElementById("map-button").hidden = false;
}

document.getElementById("next-button").addEventListener("click", () => {
  if (fightOver) {
    if (fightWon) {
      enemyIndex++;  // move on to the next enemy
    }
    startFight();    // after a loss, the same enemy again
  } else {
    setLog("Your turn. Choose a skill.");
    showSkillChoice();
  }
});

document.getElementById("map-button").addEventListener("click", showMap);

// ===============================================================
// Timer
// ===============================================================

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerDisplay() {
  const percent = (timeLeft / currentMode.time) * 100;
  const bar = document.getElementById("timer-bar");
  bar.style.width = percent + "%";
  bar.classList.toggle("low", timeLeft <= LOW_TIME_WARNING);
  document.getElementById("timer-text").textContent = timeLeft + "s";
}

function startTimer(question) {
  // Always stop the old timer first. Without this line, every new
  // question would add another timer, and the clock would speed up.
  stopTimer();

  const timerBox = document.getElementById("timer");
  if (currentMode.time === null) {
    timerBox.hidden = true;  // Fun mode: no timer at all
    return;
  }

  timerBox.hidden = false;
  timeLeft = currentMode.time;
  updateTimerDisplay();

  // setInterval runs the function every 1000 milliseconds (1 second)
  timerId = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      checkAnswer(question, null);  // null = no answer, time ran out
    }
  }, 1000);
}

// ===============================================================
// Questions
// ===============================================================

function showQuestion(question) {
  document.getElementById("question-area").hidden = false;
  document.getElementById("question-text").textContent = question.question;
  document.getElementById("feedback").textContent = "";
  document.getElementById("next-button").hidden = true;

  const choicesDiv = document.getElementById("choices");
  choicesDiv.innerHTML = "";

  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.textContent = choice;
    button.addEventListener("click", () => checkAnswer(question, index));
    choicesDiv.appendChild(button);
  });

  startTimer(question);
}

// chosenIndex is the button clicked, or null if time ran out
function checkAnswer(question, chosenIndex) {
  stopTimer();

  const buttons = document.querySelectorAll("#choices button");
  buttons.forEach(button => button.disabled = true);
  buttons[question.answer].classList.add("correct");

  const feedback = document.getElementById("feedback");

  if (chosenIndex === question.answer) {
    feedback.textContent = "Correct! " + question.explanation;
    playerAttacks();
  } else {
    if (chosenIndex === null) {
      feedback.textContent = "Time's up! " + question.explanation;
    } else {
      buttons[chosenIndex].classList.add("wrong");
      feedback.textContent = "Not quite. " + question.explanation;
    }
    enemyAttacks();
  }

  if (enemy.hp <= 0) {
    winFight();
  } else if (player.hp <= 0) {
    loseFight();
  } else {
    const nextButton = document.getElementById("next-button");
    nextButton.textContent = "Continue";
    nextButton.hidden = false;
  }
}

// ===============================================================
// Mode picker and start
// ===============================================================

function chooseMode(modeKey) {
  currentMode = MODES[modeKey];
  showMap();
}

// Each mode button stores its mode name in data-mode="..." in the HTML
document.querySelectorAll("#mode-panel button").forEach(button => {
  button.addEventListener("click", () => chooseMode(button.dataset.mode));
});

async function start() {
  requestAnimationFrame(gameLoop);  // start drawing right away
  loadSave();

  const status = document.getElementById("status");
  try {
    // Load both files at the same time and wait for both to finish
    const [questionData, combatData] = await Promise.all([
      loadJson("data/domain1.json"),
      loadJson("data/combat.json")
    ]);
    questions = questionData.questions;
    skills = combatData.skills;
    enemyTypes = combatData.enemies;
    zones = combatData.zones;

    status.hidden = true;
    showPanel("mode-panel");
  } catch (error) {
    // Most common cause: opening index.html directly instead of
    // through the local server (python -m http.server 8000)
    status.textContent = "Couldn't load game data. Are you running the local server?";
    console.error(error);
  }
}

start();