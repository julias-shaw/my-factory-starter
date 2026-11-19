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

  process.stdout.write(moveTo(13, panelLeft) + ANSI.bold + 'Status' + ANSI.reset);
  process.stdout.write(moveTo(14, panelLeft) + 'Active piece rendered.');
}

function renderFooter() {
  const footerRow = BOARD_HEIGHT + 3;
  process.stdout.write(
    moveTo(footerRow, 1) +
    ANSI.yellow +
    'Active tetromino rendered.' +
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
  createBoard,
  createPiece,
  renderBoard,
  renderPanel,
  renderFooter,
  render
};

if (require.main === module) {
  const board = createBoard();
  const activePiece = createPiece();

  process.stdout.write(ANSI.hideCursor);
  render(board, activePiece);

  const renderInterval = setInterval(() => {
    render(board, activePiece);
  }, 1000);

  process.on('SIGINT', () => {
    clearInterval(renderInterval);
    cleanup();
  });
  process.on('SIGTERM', () => {
    clearInterval(renderInterval);
    cleanup();
  });
}
