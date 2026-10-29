// XP and leveling: gaining XP, leveling up, and the death penalty.

function xpToNextLevel() {
  return save.level * XP_PER_LEVEL;
}

// Base health from the mode and level, scaled by your class, plus armor
function playerMaxHp() {
  const base = currentMode.playerHp + (save.level - 1) * HP_PER_LEVEL;
  return Math.round(base * currentClass().hpScale) + gearBonus("hp") + treeBonus("hp");
}

// Returns a message if the player leveled up, otherwise ""
function gainXp(amount) {
  save.xp += amount;
  let message = "";
  let levelsGained = 0;
  while (save.xp >= xpToNextLevel()) {
    save.xp -= xpToNextLevel();
    save.level++;
    levelsGained++;
    // Each level is also 1 skill tree point
    message = " LEVEL UP! You are now level " + save.level + ". +" + levelsGained +
      (levelsGained === 1 ? " skill tree point." : " skill tree points.");
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
