// The question countdown timer.

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerDisplay() {
  const percent = (timeLeft / questionTime) * 100;
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
  // Module gear and the skill tree add seconds, up to a cap so the timer still matters
  const extraTime = Math.min(gearBonus("time") + treeBonus("time"), currentMode.time * MAX_EXTRA_TIME);
  questionTime = currentMode.time + extraTime;
  timeLeft = questionTime;
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
