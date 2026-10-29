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

let questions = [];

// Load the question file. "async" means this function can wait
// for slow work (like reading a file) without freezing the page.
async function loadQuestions() {
  const response = await fetch("data/domain1.json");
  const data = await response.json();
  return data.questions;
}

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
}

function checkAnswer(question, chosenIndex) {
  const buttons = document.querySelectorAll("#choices button");
  buttons.forEach(button => button.disabled = true);

  buttons[question.answer].classList.add("correct");
  const feedback = document.getElementById("feedback");

  if (chosenIndex === question.answer) {
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

async function start() {
  questions = await loadQuestions();
  showQuestion(randomQuestion());
}

start();