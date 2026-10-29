// XP and leveling: gaining XP, leveling up, and the death penalty.

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
