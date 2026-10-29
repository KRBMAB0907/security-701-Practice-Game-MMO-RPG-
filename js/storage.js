// Loading data files and saving progress in the browser.

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("Could not load " + path);
  }
  return response.json();
}

// localStorage keeps small bits of text in the browser, even after
// the tab closes. It can fail (e.g. private browsing), so we use
// try/catch and simply play without saving if it does.
function loadSave() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text) {
      save = { ...save, ...JSON.parse(text) };
    }
  } catch (error) {
    console.warn("Could not load saved progress", error);
  }
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn("Could not save progress", error);
  }
}
