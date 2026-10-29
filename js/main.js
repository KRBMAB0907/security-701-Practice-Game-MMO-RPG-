const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------------------------------------------------------------
// Difficulty modes: every mode setting lives here, in one place.
//   time         seconds per question (null = no timer)
//   playerHp     your starting health
//   enemyHpScale multiplies every enemy's health (0.75 = 25% less)
//   enemyDamage  how hard enemies hit when you miss
// ---------------------------------------------------------------
const MODES = {
  fun:     { label: "Fun",     time: null, playerHp: 100, enemyHpScale: 0.75, enemyDamage: 10 },
  learner: { label: "Learner", time: 60,   playerHp: 100, enemyHpScale: 1,    enemyDamage: 15 },
  hard:    { label: "Hard",    time: 30,   playerHp: 80,  enemyHpScale: 1,    enemyDamage: 25 }
};

const LOW_TIME_WARNING = 10; // seconds left when the timer bar turns red
const FLASH_MS = 150;        // how long a hit flash lasts
const SHAKE_MS = 300;        // how long a hit shake lasts

// Loaded from the data files
let questions = [];
let skills = [];
let enemyTypes = [];

// Game state
let currentMode = null;
let currentSkill = null;
let lastQuestionId = null;
let fightOver = false;
let timerId = null;
let timeLeft = 0;

// The two fighters. flash and shake count down in milliseconds.
const player = { name: "You", hp: 100, maxHp: 100, x: 48,  y: 112, color: "#00ff9c", flash: 0, shake: 0 };
const enemy  = { name: "",    hp: 0,   maxHp: 0,   x: 256, y: 112, color: "#ff3864", flash: 0, shake: 0 };

// Damage numbers that float up and fade out
let floatingTexts = [];

// ===============================================================
// Loading data
// ===============================================================

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("Could not load " + path);
  }
  return response.json();
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

function drawFighter(fighter) {
  // A shake moves the fighter a random 1-2 pixels each frame
  const offset = fighter.shake > 0 ? Math.round(Math.random() * 4 - 2) : 0;
  ctx.fillStyle = fighter.flash > 0 ? "#ffffff" : fighter.color;
  ctx.fillRect(fighter.x + offset, fighter.y, 16, 16);
}

function draw() {
  // Background and floor
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1c2733";
  ctx.fillRect(0, 128, canvas.width, 2);

  // Names at the top corners
  ctx.font = "8px monospace";
  ctx.fillStyle = "#d8f3e8";
  ctx.textAlign = "left";
  ctx.fillText(player.name, 8, 14);
  ctx.textAlign = "right";
  ctx.fillText(enemy.name, canvas.width - 8, 14);

  if (enemy.maxHp > 0) {
    drawFighter(player);
    drawFighter(enemy);
    drawHealthBar(player);
    drawHealthBar(enemy);
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
// Combat
// ===============================================================

function hit(fighter, amount, color) {
  fighter.hp = Math.max(fighter.hp - amount, 0);
  fighter.flash = FLASH_MS;
  fighter.shake = SHAKE_MS;
  floatingTexts.push({ value: "-" + amount, x: fighter.x + 8, y: fighter.y - 34, color: color, life: 900, maxLife: 900 });
}

function startFight() {
  const type = enemyTypes[0];  // only one enemy for now
  enemy.name = type.name;
  enemy.maxHp = Math.round(type.hp * currentMode.enemyHpScale);
  enemy.hp = enemy.maxHp;

  player.maxHp = currentMode.playerHp;
  player.hp = player.maxHp;

  fightOver = false;
  floatingTexts = [];
  setLog("A " + enemy.name + " appears!");
  showSkillChoice();
}

function setLog(message) {
  document.getElementById("battle-log").textContent = message;
}

function showSkillChoice() {
  document.getElementById("question-area").hidden = true;
  document.getElementById("next-button").hidden = true;

  const skillsDiv = document.getElementById("skills");
  skillsDiv.innerHTML = "";
  skillsDiv.hidden = false;

  skills.forEach(skill => {
    const button = document.createElement("button");
    button.textContent = skill.name + " (" + skill.damage + " damage)";

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
  const correct = chosenIndex === question.answer;

  if (correct) {
    feedback.textContent = "Correct! " + question.explanation;
    hit(enemy, currentSkill.damage, "#00ff9c");
    setLog(currentSkill.name + " hits for " + currentSkill.damage + " damage!");
  } else {
    if (chosenIndex === null) {
      feedback.textContent = "Time's up! " + question.explanation;
    } else {
      buttons[chosenIndex].classList.add("wrong");
      feedback.textContent = "Not quite. " + question.explanation;
    }
    hit(player, currentMode.enemyDamage, "#ff3864");
    setLog(currentSkill.name + " fizzles! The " + enemy.name + " hits you for " + currentMode.enemyDamage + ".");
  }

  const nextButton = document.getElementById("next-button");
  if (enemy.hp <= 0) {
    fightOver = true;
    setLog("Victory! The " + enemy.name + " is defeated.");
    nextButton.textContent = "Fight again";
  } else if (player.hp <= 0) {
    fightOver = true;
    setLog("Defeated! Review the explanation and try again.");
    nextButton.textContent = "Try again";
  } else {
    nextButton.textContent = "Continue";
  }
  nextButton.hidden = false;
}

document.getElementById("next-button").addEventListener("click", () => {
  if (fightOver) {
    startFight();
  } else {
    setLog("Your turn. Choose a skill.");
    showSkillChoice();
  }
});

// ===============================================================
// Mode picker and start
// ===============================================================

function chooseMode(modeKey) {
  currentMode = MODES[modeKey];
  document.getElementById("mode-label").textContent = "Mode: " + currentMode.label;
  document.getElementById("mode-panel").hidden = true;
  document.getElementById("battle-panel").hidden = false;
  startFight();
}

// Each mode button stores its mode name in data-mode="..." in the HTML
document.querySelectorAll("#mode-panel button").forEach(button => {
  button.addEventListener("click", () => chooseMode(button.dataset.mode));
});

async function start() {
  requestAnimationFrame(gameLoop);  // start drawing right away

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

    status.hidden = true;
    document.getElementById("mode-panel").hidden = false;
  } catch (error) {
    // Most common cause: opening index.html directly instead of
    // through the local server (python -m http.server 8000)
    status.textContent = "Couldn't load game data. Are you running the local server?";
    console.error(error);
  }
}

start();