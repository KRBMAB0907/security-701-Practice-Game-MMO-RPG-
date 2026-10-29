// Settings: difficulty modes and balance numbers.
// Tweak these to change how the game feels.

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
const RECENT_QUESTION_MEMORY = 6; // how many recent questions to avoid repeating
const SAVE_KEY = "secplus-rpg-save";

// Animation timings (milliseconds)
const FLASH_MS = 150;
const SHAKE_MS = 300;
