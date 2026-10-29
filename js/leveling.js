// XP and leveling: gaining XP, leveling up, and the death penalty.

function xpToNextLevel() {
  return save.level * XP_PER_LEVEL;
}

// Base health from the mode and level, scaled by your class, plus armor
function playerMaxHp() {
  const base = currentMode.playerHp + (save.level - 1) * HP_PER_LEVEL;
  return Math.round(base * currentClass().hpScale) + gearBonus("hp");
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
