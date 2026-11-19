#!/usr/bin/env node

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const BOARD_TOP = 1;
const BOARD_LEFT = 1;

const ANSI = {
  clear: '\x1b[2J',
  home: '\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

const TETROMINO_SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const TETROMINO_COLORS = {
  I: ANSI.cyan,
  O: ANSI.yellow,
  T: ANSI.magenta,
  S: ANSI.green,
  Z: ANSI.red,
  J: ANSI.blue,
  L: ANSI.white
};

const PIECE_NAMES = Object.keys(TETROMINO_SHAPES);

const WALL_KICK_OFFSETS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-2, 0],
  [2, 0],
  [0, 1]
];

const GRAVITY_MS = 1000;

function moveTo(row, col) {
  return `\x1b[${row};${col}H`;
}

function clearScreen() {
  process.stdout.write(ANSI.clear + ANSI.home);
}

function drawBox(topRow, leftCol, width, height) {
  const horizontal = '─'.repeat(width - 2);
  process.stdout.write(moveTo(topRow, leftCol) + '┌' + horizontal + '┐');
  for (let row = 1; row < height - 1; row++) {
    process.stdout.write(moveTo(topRow + row, leftCol) + '│');
    process.stdout.write(moveTo(topRow + row, leftCol + width - 1) + '│');
  }
  process.stdout.write(moveTo(topRow + height - 1, leftCol) + '└' + horizontal + '┘');
}

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function createStats() {
  return { score: 0, lines: 0, level: 1 };
}

function createPiece(rng = Math.random) {
  const name = PIECE_NAMES[Math.floor(rng() * PIECE_NAMES.length)];
  const matrix = TETROMINO_SHAPES[name].map(row => row.slice());
  return {
    name,
    color: TETROMINO_COLORS[name],
    x: Math.floor((BOARD_WIDTH - matrix[0].length) / 2),
    y: 0,
    matrix
  };
}

function rotateMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (matrix[y][x]) {
        rotated[x][rows - 1 - y] = matrix[y][x];
      }
    }
  }
  return rotated;
}

function isValidPosition(board, piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (piece.matrix[y][x]) {
        const boardX = piece.x + x;
        const boardY = piece.y + y;
        if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
          return false;
        }
        if (boardY >= 0 && board[boardY][boardX]) {
          return false;
        }
      }
    }
  }
  return true;
}

function movePiece(board, piece, dx, dy) {
  const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return isValidPosition(board, moved) ? moved : null;
}

function rotatePiece(board, piece) {
  const rotatedMatrix = rotateMatrix(piece.matrix);
  for (const [dx, dy] of WALL_KICK_OFFSETS) {
    const rotated = {
      ...piece,
      x: piece.x + dx,
      y: piece.y + dy,
      matrix: rotatedMatrix
    };
    if (isValidPosition(board, rotated)) {
      return rotated;
    }
  }
  return null;
}

function lockPiece(board, piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (piece.matrix[y][x]) {
        const boardY = piece.y + y;
        const boardX = piece.x + x;
        if (boardY >= 0) {
          board[boardY][boardX] = piece.color;
        }
      }
    }
  }
}

function clearLines(board) {
  let cleared = 0;
  for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== null)) {
      board.splice(y, 1);
      board.unshift(Array(BOARD_WIDTH).fill(null));
      cleared++;
      y++;
    }
  }
  return cleared;
}

function updateScore(stats, cleared) {
  const points = [0, 100, 300, 500, 800];
  stats.score += points[cleared] || 0;
  stats.lines += cleared;
  stats.level = Math.floor(stats.lines / 10) + 1;
}

function lockAndSpawn(board, piece, rng = Math.random, stats = createStats()) {
  lockPiece(board, piece);
  const cleared = clearLines(board);
  updateScore(stats, cleared);
  const next = createPiece(rng);
  if (!isValidPosition(board, next)) {
    return { next: null, stats, gameOver: true };
  }
  return { next, stats, gameOver: false };
}

function hardDrop(board, piece) {
  let current = piece;
  while (true) {
    const next = movePiece(board, current, 0, 1);
    if (!next) break;
    current = next;
  }
  return current;
}

function softDrop(board, piece) {
  return movePiece(board, piece, 0, 1);
}

function renderBoard(board, activePiece) {
  const rows = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (board[y][x]) {
        row += board[y][x] + '█' + ANSI.reset;
      } else if (activePiece) {
        const py = y - activePiece.y;
        const px = x - activePiece.x;
        if (
          py >= 0 &&
          py < activePiece.matrix.length &&
          px >= 0 &&
          px < activePiece.matrix[py].length &&
          activePiece.matrix[py][px]
        ) {
          row += activePiece.color + '█' + ANSI.reset;
        } else {
          row += ' ';
        }
      } else {
        row += ' ';
      }
    }
    rows.push(row);
  }
  return rows;
}

function renderPanel(stats = createStats()) {
  const panelLeft = BOARD_WIDTH + 5;

  process.stdout.write(moveTo(1, panelLeft) + ANSI.bold + ANSI.cyan + 'TETRIS' + ANSI.reset);
  process.stdout.write(moveTo(3, panelLeft) + ANSI.bold + 'Score' + ANSI.reset);
  process.stdout.write(moveTo(4, panelLeft) + stats.score.toString());
  process.stdout.write(moveTo(6, panelLeft) + ANSI.bold + 'Level' + ANSI.reset);
  process.stdout.write(moveTo(7, panelLeft) + stats.level.toString());
  process.stdout.write(moveTo(9, panelLeft) + ANSI.bold + 'Lines' + ANSI.reset);
  process.stdout.write(moveTo(10, panelLeft) + stats.lines.toString());

  process.stdout.write(moveTo(13, panelLeft) + ANSI.bold + 'Controls' + ANSI.reset);
  process.stdout.write(moveTo(14, panelLeft) + '← / → move');
  process.stdout.write(moveTo(15, panelLeft) + '↑ rotate');
  process.stdout.write(moveTo(16, panelLeft) + '↓ soft drop');
  process.stdout.write(moveTo(17, panelLeft) + 'space hard drop');
  process.stdout.write(moveTo(18, panelLeft) + 'P pause');
  process.stdout.write(moveTo(19, panelLeft) + 'Q quit');
}

function renderFooter(gameOver = false) {
  const footerRow = BOARD_HEIGHT + 3;
  const text = gameOver
    ? 'GAME OVER - R restart | Q quit'
    : 'Move ←/→  Rotate ↑  Soft drop ↓  Hard drop space';
  process.stdout.write(moveTo(footerRow, 1) + ANSI.yellow + text + ANSI.reset);
}

function renderStatus({ paused = false, gameOver = false } = {}) {
  const footerRow = BOARD_HEIGHT + 3;
  let text;
  if (gameOver) {
    text = 'GAME OVER - R restart | Q quit';
  } else if (paused) {
    text = 'PAUSED - P resume | Q quit';
  } else {
    text = 'Move ←/→  Rotate ↑  Soft drop ↓  Hard drop space';
  }
  process.stdout.write(moveTo(footerRow, 1) + ANSI.yellow + text + ANSI.reset);
}

function render(board, activePiece, stats, { paused = false } = {}) {
  clearScreen();
  const boardRows = renderBoard(board, activePiece);
  const boxWidth = BOARD_WIDTH + 2;
  const boxHeight = BOARD_HEIGHT + 2;
  drawBox(BOARD_TOP, BOARD_LEFT, boxWidth, boxHeight);
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    process.stdout.write(moveTo(BOARD_TOP + 1 + y, BOARD_LEFT + 1) + boardRows[y]);
  }
  renderPanel(stats);
  renderStatus({ paused, gameOver: !activePiece });
}

function cleanup() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdout.write(ANSI.showCursor + ANSI.reset);
}

module.exports = {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  ANSI,
  TETROMINO_SHAPES,
  TETROMINO_COLORS,
  PIECE_NAMES,
  WALL_KICK_OFFSETS,
  GRAVITY_MS,
  createBoard,
  createStats,
  createPiece,
  rotateMatrix,
  isValidPosition,
  movePiece,
  rotatePiece,
  lockPiece,
  clearLines,
  updateScore,
  lockAndSpawn,
  hardDrop,
  softDrop,
  renderBoard,
  renderPanel,
  renderFooter,
  render
};

if (require.main === module) {
  let board = createBoard();
  let activePiece = createPiece();
  let stats = createStats();
  let gameOver = false;
  let paused = false;
  let gravityInterval;

  function stopGame() {
    clearInterval(gravityInterval);
    cleanup();
    process.exit(0);
  }

  function restartGame() {
    board = createBoard();
    stats = createStats();
    activePiece = createPiece();
    gameOver = false;
    paused = false;
    clearInterval(gravityInterval);
    gravityInterval = setInterval(tick, GRAVITY_MS);
    render(board, activePiece, stats, { paused });
  }

  function handleLockAndSpawn() {
    const result = lockAndSpawn(board, activePiece, Math.random, stats);
    stats = result.stats;
    if (result.gameOver) {
      gameOver = true;
      clearInterval(gravityInterval);
      activePiece = null;
    } else {
      activePiece = result.next;
    }
  }

  function tick() {
    if (gameOver || paused) return;
    const moved = softDrop(board, activePiece);
    if (moved) {
      activePiece = moved;
    } else {
      handleLockAndSpawn();
    }
    render(board, activePiece, stats, { paused });
  }

  process.stdout.write(ANSI.hideCursor);
  render(board, activePiece, stats, { paused });

  const readline = require('readline');
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.setEncoding('utf8');
  process.stdin.resume();

  gravityInterval = setInterval(tick, GRAVITY_MS);

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    if (key.ctrl && key.name === 'c') {
      stopGame();
      return;
    }
    if (key.name === 'q' || key.name === 'Q') {
      stopGame();
      return;
    }

    if (paused) {
      if (key.name === 'p' || key.name === 'P') {
        paused = false;
        render(board, activePiece, stats, { paused });
      }
      return;
    }

    if (gameOver) {
      if (key.name === 'r' || key.name === 'R') {
        restartGame();
      }
      return;
    }

    if (key.name === 'p' || key.name === 'P') {
      paused = true;
      render(board, activePiece, stats, { paused });
      return;
    }

    if (key.name === 'left') {
      activePiece = movePiece(board, activePiece, -1, 0) || activePiece;
    } else if (key.name === 'right') {
      activePiece = movePiece(board, activePiece, 1, 0) || activePiece;
    } else if (key.name === 'up') {
      activePiece = rotatePiece(board, activePiece) || activePiece;
    } else if (key.name === 'down') {
      const moved = softDrop(board, activePiece);
      if (moved) {
        activePiece = moved;
      } else {
        handleLockAndSpawn();
      }
    } else if (key.name === 'space') {
      activePiece = hardDrop(board, activePiece);
      handleLockAndSpawn();
    }
    render(board, activePiece, stats, { paused });
  });

  process.on('SIGINT', stopGame);
  process.on('SIGTERM', stopGame);
  process.on('exit', cleanup);
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    cleanup();
    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });
}
