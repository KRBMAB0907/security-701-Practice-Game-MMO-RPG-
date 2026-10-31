// Game state: data loaded from files, saved progress,
// the current fight, and the two fighters.

// Loaded from the data files
let topicNames = {};  // topic id -> readable name, built from topics.json
let questions = [];
let skills = [];
let enemyTypes = [];
let zones = [];       // every zone in every built area, in play order
let areas = [];       // the 5 areas, each with its own .zones list
let domainNames = {}; // domain number -> name, from topics.json
let classes = [];
let topicDomains = {}; // topic id -> domain number, built from topics.json
let skillTree = null;  // data/skilltree.json
let treeNodes = [];    // every skill tree node from every branch, in one list
let ascensionData = null; // data/ascension.json
let campData = null;   // data/camp.json: scrap names and crafting costs

// A brand-new save: also used by "Reset progress"
function newSave() {
  return {
    level: 1, xp: 0, clearedZones: [], classId: null,
    inventory: [], equipped: { tool: null, armor: null, module: null }, nextItemId: 1,
    tree: {},  // skill tree points per node, e.g. { "integrity": 2 }
    ascendancy: null, ascension: {},  // chosen ascendancy and its taken nodes
    // Scrap from smelting at the home camp, one kind per loot tier
    materials: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    // Answers per exam topic, for mastery ranks, e.g. { "phishing": { right: 7, asked: 9 } }
    mastery: {}
  };
}

// Saved progress (kept in the browser between visits)
let save = newSave();

// Current game state
let currentMode = null;
let currentZone = null;
let selectedArea = null; // the area shown on the map
let enemyIndex = 0;       // which enemy in the zone we're fighting
let currentSkill = null;
let recentQuestionIds = [];  // the last few questions asked, to avoid repeats
let fightOver = false;
let fightWon = false;
let timerId = null;
let timeLeft = 0;
let questionTime = 0;     // full time for the current question, including gear bonus
let failoverUsed = false; // the Failover Core legendary works once per fight
let turnInProgress = false; // true while the enemy's attack is still playing out
let questionShownAt = 0;  // when the current question appeared (for Rapid Response)
let ascFight = {};        // ascension effects that count up during a fight (see js/ascension.js)
let drillTopic = null;     // the topic being drilled with Su Root, or null in a normal fight
let drillAsked = 0;        // questions asked so far in this drill
let drillRight = 0;        // ...and how many were right

// The two fighters. flash and shake count down in milliseconds.
// spritePath is the image to draw; tint = true recolors it with `color`.
// lunge and dodge count down in milliseconds, like flash and shake.
const player = { name: "You", hp: 100, maxHp: 100, x: 48,  y: 112, color: "#00ff9c", flash: 0, shake: 0, lunge: 0, dodge: 0, spritePath: null, tint: false };
const enemy  = { name: "",    hp: 0,   maxHp: 0,   x: 256, y: 112, color: "#ff3864", flash: 0, shake: 0, lunge: 0, dodge: 0, spritePath: null, tint: true };

// Damage numbers that float up and fade out
let floatingTexts = [];
