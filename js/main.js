const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Background
ctx.fillStyle = "#0a0e14";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Player placeholder (green)
ctx.fillStyle = "#00ff9c";
ctx.fillRect(40, 120, 16, 16);

// Enemy placeholder (red)
ctx.fillStyle = "#ff3864";
ctx.fillRect(264, 120, 16, 16);

// ---------------------------------------------------------------
// Difficulty modes: every mode setting lives here, in one place.
// time is in seconds; null means no timer.
// Enemy health, damage and drop chances get added here in Step 5.
// ---------------------------------------------------------------
const MODES = {
  fun:     { label: "Fun",     time: null },
  learner: { label: "Learner", time: 60 },
  hard:    { label: "Hard",    time: 30 }
};

const LOW_TIME_WARNING = 10; // seconds left when the bar turns red

let questions = [];
let currentMode = null;
let timerId = null;  // the running countdown, so we can stop it
let timeLeft = 0;

// Load the question file. "async" means this function can wait
// for slow work (like reading a file) without freezing the page.
async function loadQuestions() {
  const response = await fetch("data/domain1.json");
  const data = await response.json();
  return data.questions;
}

// ---------- Timer ----------

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

// ---------- Questions ----------

function showQuestion(question) {
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

  if (chosenIndex === null) {
    feedback.textContent = "Time's up! " + question.explanation;
  } else if (chosenIndex === question.answer) {
    feedback.textContent = "Correct! " + question.explanation;
  } else {
    buttons[chosenIndex].classList.add("wrong");
    feedback.textContent = "Not quite. " + question.explanation;
  }

  document.getElementById("next-button").hidden = false;
}

function randomQuestion() {
  const index = Math.floor(Math.random() * questions.length);
  return questions[index];
}

document.getElementById("next-button").addEventListener("click", () => {
  showQuestion(randomQuestion());
});

// ---------- Mode picker ----------

function chooseMode(modeKey) {
  currentMode = MODES[modeKey];
  document.getElementById("mode-label").textContent = "Mode: " + currentMode.label;
  document.getElementById("mode-panel").hidden = true;
  document.getElementById("question-panel").hidden = false;
  showQuestion(randomQuestion());
}

// Each mode button stores its mode name in data-mode="..." in the HTML
document.querySelectorAll("#mode-panel button").forEach(button => {
  button.addEventListener("click", () => chooseMode(button.dataset.mode));
});

// ---------- Start ----------

async function start() {
  const status = document.getElementById("status");
  try {
    questions = await loadQuestions();
    status.hidden = true;
    document.getElementById("mode-panel").hidden = false;
  } catch (error) {
    // Most common cause: opening index.html directly instead of
    // through the local server (python -m http.server 8000)
    status.textContent = "Couldn't load questions. Are you running the local server?";
    console.error(error);
  }
}

start();