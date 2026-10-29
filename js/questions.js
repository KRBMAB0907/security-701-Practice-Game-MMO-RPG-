// Showing questions and checking answers.

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
