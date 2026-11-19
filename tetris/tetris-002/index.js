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

function renderPanel() {
  const panelLeft = BOARD_WIDTH + 5;

  process.stdout.write(moveTo(1, panelLeft) + ANSI.bold + ANSI.cyan + 'TETRIS' + ANSI.reset);
  process.stdout.write(moveTo(3, panelLeft) + ANSI.bold + 'Score' + ANSI.reset);
  process.stdout.write(moveTo(4, panelLeft) + '0');
  process.stdout.write(moveTo(6, panelLeft) + ANSI.bold + 'Level' + ANSI.reset);
  process.stdout.write(moveTo(7, panelLeft) + '1');
  process.stdout.write(moveTo(9, panelLeft) + ANSI.bold + 'Lines' + ANSI.reset);
  process.stdout.write(moveTo(10, panelLeft) + '0');

  process.stdout.write(moveTo(13, panelLeft) + ANSI.bold + 'Controls' + ANSI.reset);
  process.stdout.write(moveTo(14, panelLeft) + '← / → move');
  process.stdout.write(moveTo(15, panelLeft) + '↑ rotate');
}

function renderFooter() {
  const footerRow = BOARD_HEIGHT + 3;
  process.stdout.write(
    moveTo(footerRow, 1) +
    ANSI.yellow +
    'Move with ← / →, rotate with ↑.' +
    ANSI.reset
  );
}

function render(board, activePiece) {
  clearScreen();
  const boardRows = renderBoard(board, activePiece);
  const boxWidth = BOARD_WIDTH + 2;
  const boxHeight = BOARD_HEIGHT + 2;
  drawBox(BOARD_TOP, BOARD_LEFT, boxWidth, boxHeight);
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    process.stdout.write(moveTo(BOARD_TOP + 1 + y, BOARD_LEFT + 1) + boardRows[y]);
  }
  renderPanel();
  renderFooter();
}

function cleanup() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdout.write(ANSI.showCursor);
  process.exit(0);
}

module.exports = {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  ANSI,
  TETROMINO_SHAPES,
  TETROMINO_COLORS,
  PIECE_NAMES,
  WALL_KICK_OFFSETS,
  createBoard,
  createPiece,
  rotateMatrix,
  isValidPosition,
  movePiece,
  rotatePiece,
  renderBoard,
  renderPanel,
  renderFooter,
  render
};

if (require.main === module) {
  const board = createBoard();
  let activePiece = createPiece();

  process.stdout.write(ANSI.hideCursor);
  render(board, activePiece);

  const readline = require('readline');
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.setEncoding('utf8');
  process.stdin.resume();

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    if (key.ctrl && key.name === 'c') {
      cleanup();
      return;
    }
    if (key.name === 'left') {
      activePiece = movePiece(board, activePiece, -1, 0) || activePiece;
    } else if (key.name === 'right') {
      activePiece = movePiece(board, activePiece, 1, 0) || activePiece;
    } else if (key.name === 'up') {
      activePiece = rotatePiece(board, activePiece) || activePiece;
    }
    render(board, activePiece);
  });

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
