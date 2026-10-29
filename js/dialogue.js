// Dialogue: battle narration in the log and enemy taunts in a speech bubble.
// All the lines live in data/dialogue.json. Narration lines use
// placeholders like {enemy}, {skill} and {damage}; taunts are chosen from
// the exam topic the enemy stands for, so a phishing enemy talks phishing.

let dialogue = null;  // loaded from data/dialogue.json by main.js
let speech = null;    // the speech bubble showing now: { text, life }

const SPEECH_MS = 2800;  // how long a speech bubble stays up

function randomLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

// Fill in {placeholders}, e.g. fillLine("{enemy} hits!", { enemy: "Gremlin" })
function fillLine(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
}

// A random narration line of one kind ("playerHit", "enemyMiss"...), filled in
function narrate(kind, values) {
  return fillLine(randomLine(dialogue.narration[kind]), values);
}

// Make the enemy say something in a speech bubble on the game screen
function say(text) {
  speech = { text: text, life: SPEECH_MS };
}

// An enemy taunt. Intros and hits use lines about the enemy's current
// topic when there are any; misses and phase changes use general lines.
function enemyTaunt(kind) {
  const topicLines = dialogue.taunts[currentWeakness()];
  const useTopic = topicLines && (kind === "intro" || kind === "hit");
  say(randomLine(useTopic ? topicLines : dialogue.genericTaunts[kind]));
}
