const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Background
ctx.fillStyle = "#0a0e14";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Player placeholder (green)
ctx.fillStyle = "#00ff9c";
ctx.fillRect(40, 120, 16, 16);

// Enemy placeholder (red)
ctx.fillStyle = "#ff3864";
ctx.fillRect(264, 120, 16, 16);