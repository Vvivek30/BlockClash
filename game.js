const COLS = 10;
const ROWS = 20;
const STORAGE_KEY = "blockclash-highscores";

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const movesEl = document.getElementById("moves");
const restartBtn = document.getElementById("restartBtn");
const nextPieceEl = document.getElementById("nextPiece");
const leaderboardEl = document.getElementById("leaderboard");

const pieces = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: "#38bdf8",
    name: "I"
  },
  O: {
    shape: [[1, 1], [1, 1]],
    color: "#facc15",
    name: "O"
  },
  T: {
    shape: [[0, 1, 0], [1, 1, 1]],
    color: "#a78bfa",
    name: "T"
  },
  S: {
    shape: [[0, 1, 1], [1, 1, 0]],
    color: "#34d399",
    name: "S"
  },
  Z: {
    shape: [[1, 1, 0], [0, 1, 1]],
    color: "#fb7185",
    name: "Z"
  },
  J: {
    shape: [[1, 0, 0], [1, 1, 1]],
    color: "#60a5fa",
    name: "J"
  },
  L: {
    shape: [[0, 0, 1], [1, 1, 1]],
    color: "#fb923c",
    name: "L"
  }
};

let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let moves = 0;
let gameOver = false;
let dropTimer = null;
let highScores = loadHighScores();

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createPiece(type) {
  const spec = pieces[type];
  return {
    type,
    shape: spec.shape.map((row) => [...row]),
    x: Math.floor((COLS - spec.shape[0].length) / 2),
    y: -1,
    color: spec.color,
    name: spec.name
  };
}

function randomPieceType() {
  const types = Object.keys(pieces);
  return types[Math.floor(Math.random() * types.length)];
}

function cloneShape(shape) {
  return shape.map((row) => [...row]);
}

function canPlace(piece, x, y) {
  return piece.shape.every((row, rowIndex) =>
    row.every((cell, colIndex) => {
      if (!cell) return true;
      const nextX = x + colIndex;
      const nextY = y + rowIndex;
      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) return false;
      if (nextY >= 0 && board[nextY][nextX]) return false;
      return true;
    })
  );
}

function rotateMatrix(shape) {
  const size = shape.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      rotated[col][size - 1 - row] = shape[row][col];
    }
  }

  return rotated;
}

function lockPiece() {
  currentPiece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;
      const boardY = currentPiece.y + rowIndex;
      const boardX = currentPiece.x + colIndex;
      if (boardY >= 0) board[boardY][boardX] = currentPiece.color;
    });
  });

  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row].every(Boolean)) {
      board.splice(row, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
    }
  }

  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 5) + 1;
  }
}

function spawnPiece() {
  currentPiece = nextPiece || createPiece(randomPieceType());
  nextPiece = createPiece(randomPieceType());

  if (!canPlace(currentPiece, currentPiece.x, currentPiece.y)) {
    endGame();
    return;
  }

  render();
}

function endGame() {
  gameOver = true;
  clearInterval(dropTimer);

  const entry = {
    score,
    moves,
    lines,
    date: new Date().toLocaleDateString()
  };

  highScores = [...highScores, entry]
    .sort((a, b) => b.score - a.score || a.moves - b.moves)
    .slice(0, 5);
  saveHighScores();
  renderLeaderboard();
  render();
}

function restartGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  moves = 0;
  gameOver = false;
  clearInterval(dropTimer);
  currentPiece = null;
  nextPiece = null;
  spawnPiece();
  startDropLoop();
  render();
}

function movePiece(dx, dy) {
  if (!currentPiece || gameOver) return;
  const nextX = currentPiece.x + dx;
  const nextY = currentPiece.y + dy;

  if (canPlace(currentPiece, nextX, nextY)) {
    currentPiece.x = nextX;
    currentPiece.y = nextY;
    moves += 1;
    render();
    return true;
  }

  if (dy === 1) {
    lockPiece();
  }
  return false;
}

function rotatePiece() {
  if (!currentPiece || gameOver) return;

  const rotated = rotateMatrix(currentPiece.shape);
  const offsets = [0, -1, 1, -2, 2];

  for (const offset of offsets) {
    if (canPlace({ ...currentPiece, shape: rotated }, currentPiece.x + offset, currentPiece.y)) {
      currentPiece.shape = rotated;
      currentPiece.x += offset;
      moves += 1;
      render();
      return;
    }
  }
}

function hardDrop() {
  if (!currentPiece || gameOver) return;

  let dropped = 0;
  while (canPlace(currentPiece, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y += 1;
    dropped += 1;
    moves += 1;
  }

  if (dropped > 0) {
    render();
  }

  lockPiece();
}

function startDropLoop() {
  clearInterval(dropTimer);
  dropTimer = setInterval(() => {
    movePiece(0, 1);
  }, Math.max(120, 800 - (level - 1) * 80));
}

function render() {
  const cells = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const color = board[row][col];
      cells.push(`<div class="cell ${color ? "filled" : ""}" style="background:${color || ""};"></div>`);
    }
  }

  if (currentPiece && !gameOver) {
    currentPiece.shape.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell) return;
        const boardY = currentPiece.y + rowIndex;
        const boardX = currentPiece.x + colIndex;
        if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
          cells[(boardY * COLS) + boardX] = `<div class="cell filled" style="background:${currentPiece.color};"></div>`;
        }
      });
    });
  }

  boardEl.innerHTML = cells.join("");
  boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;

  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  movesEl.textContent = moves;

  renderNextPiece();
}

function renderNextPiece() {
  const preview = nextPiece || createPiece(randomPieceType());
  const cells = [];
  const previewGrid = Array.from({ length: 4 }, () => Array(4).fill(null));
  const shape = preview.shape;
  const offsetX = Math.floor((4 - shape[0].length) / 2);
  const offsetY = Math.floor((4 - shape.length) / 2);

  shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        previewGrid[rowIndex + offsetY][colIndex + offsetX] = preview.color;
      }
    });
  });

  previewGrid.forEach((row) => {
    row.forEach((color) => {
      cells.push(`<div class="cell ${color ? "filled" : ""}" style="background:${color || ""};"></div>`);
    });
  });

  nextPieceEl.innerHTML = cells.join("");
}

function renderLeaderboard() {
  if (!highScores.length) {
    leaderboardEl.innerHTML = "<li>No scores yet</li>";
    return;
  }

  leaderboardEl.innerHTML = highScores
    .map((entry, index) => {
      const label = `${index + 1}. ${entry.score}`;
      return `<li><span>${label}</span><strong>${entry.moves} moves</strong></li>`;
    })
    .join("");
}

function loadHighScores() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function saveHighScores() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores));
}

function handleKeydown(event) {
  if (event.code === "ArrowLeft") {
    event.preventDefault();
    movePiece(-1, 0);
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    movePiece(1, 0);
  } else if (event.code === "ArrowDown") {
    event.preventDefault();
    movePiece(0, 1);
  } else if (event.code === "ArrowUp") {
    event.preventDefault();
    rotatePiece();
  } else if (event.code === "Space") {
    event.preventDefault();
    hardDrop();
  }
}

restartBtn.addEventListener("click", restartGame);
document.addEventListener("keydown", handleKeydown);

renderLeaderboard();
restartGame();
