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

  // Elimination Engine legendary: knock out one random wrong answer.
  // The button stays in place (disabled) so answer numbers still line up.
  if (hasEffect("eliminate")) {
    const wrongIndexes = question.choices.map((_, index) => index).filter(index => index !== question.answer);
    const removed = randomFrom(wrongIndexes);
    const button = choicesDiv.children[removed];
    button.disabled = true;
    button.classList.add("eliminated");
  }

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
  } else if (chosenIndex === null) {
    feedback.textContent = "Time's up! " + question.explanation;
  } else {
    buttons[chosenIndex].classList.add("wrong");
    feedback.textContent = "Not quite. " + question.explanation;
  }

  playTurn(correct, chosenIndex === null);  // see combat.js
}
