#!/usr/bin/env node

// Tetris-001 terminal entry point
// Renders the game board, side panel, and controls.

const process = require('process');

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const MAX_ROWS = 24;

const ESC = '\x1b';
const CLEAR = `${ESC}[2J${ESC}[H`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

const TL = '╔';
const TR = '╗';
const BL = '╚';
const BR = '╝';
const H = '═';
const V = '║';
const EMPTY = ' ';
const BLOCK = '█';

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const PIECE_SYMBOLS = ['█', '▓', '▒', '░', '■', '▤', '▥'];

let board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
let currentPiece = null;
let score = 0;
let lines = 0;
let level = 1;

function randomPiece() {
  const names = Object.keys(SHAPES);
  const name = names[Math.floor(Math.random() * names.length)];
  const shape = SHAPES[name];
  const symbol = PIECE_SYMBOLS[names.indexOf(name)];
  return {
    name,
    shape,
    symbol,
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: 0,
  };
}

function spawnPiece() {
  currentPiece = randomPiece();
}

// Boundary check for the current piece. Full collision detection with the
// board comes in the next task.
function fits(piece) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const x = piece.x + c;
      const y = piece.y + r;
      if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return false;
    }
  }
  return true;
}

function movePiece(dx, dy) {
  const candidate = { ...currentPiece, x: currentPiece.x + dx, y: currentPiece.y + dy };
  if (!fits(candidate)) return false;
  currentPiece = candidate;
  return true;
}

function moveLeft() {
  return movePiece(-1, 0);
}

function moveRight() {
  return movePiece(1, 0);
}

function moveDown() {
  return movePiece(0, 1);
}

function rotate(dir) {
  const shape = currentPiece.shape;
  const cols = shape[0].length;

  const rotated = dir === 'cw'
    ? Array.from({ length: cols }, (_, c) => shape.map((row) => row[c]).reverse())
    : Array.from({ length: cols }, (_, c) =>
        shape.map((row) => row[cols - 1 - c])
      );

  // Try the rotated shape in place, then nudge horizontally if it clips.
  for (const offset of [0, -1, 1, -2, 2]) {
    const candidate = { ...currentPiece, shape: rotated, x: currentPiece.x + offset };
    if (fits(candidate)) {
      currentPiece = candidate;
      return true;
    }
  }
  return false;
}

function getDisplayCell(r, c) {
  // Current piece overlay
  if (currentPiece) {
    const pr = r - currentPiece.y;
    const pc = c - currentPiece.x;
    if (
      pr >= 0 &&
      pr < currentPiece.shape.length &&
      pc >= 0 &&
      pc < currentPiece.shape[pr].length &&
      currentPiece.shape[pr][pc]
    ) {
      return currentPiece.symbol;
    }
  }
  return board[r][c] ? BLOCK : EMPTY;
}

function draw() {
  const topBorder = `${TL}${H.repeat(BOARD_WIDTH)}${TR}`;
  const bottomBorder = `${BL}${H.repeat(BOARD_WIDTH)}${BR}`;

  const sidePanel = [
    `SCORE: ${score}`,
    `LINES: ${lines}`,
    `LEVEL: ${level}`,
    '',
    'CONTROLS',
    'L/R move',
    'U rotate',
    'D soft drop',
    'P pause',
    'Q quit',
  ];

  const rows = [];
  rows.push('    TERMINAL TETRIS    ');
  rows.push(`${topBorder}  ${sidePanel[0] || ''}`);

  for (let r = 0; r < BOARD_HEIGHT; r++) {
    let rowContent = V;
    for (let c = 0; c < BOARD_WIDTH; c++) {
      rowContent += getDisplayCell(r, c);
    }
    rowContent += V;
    const side = sidePanel[r + 1] || '';
    rows.push(`${rowContent}  ${side}`);
  }

  rows.push(`${bottomBorder}  ${sidePanel[BOARD_HEIGHT + 1] || ''}`);

  while (rows.length > MAX_ROWS) {
    rows.pop();
  }

  process.stdout.write(CLEAR + HIDE_CURSOR + rows.join('\n'));
}

function cleanup() {
  process.stdout.write(SHOW_CURSOR);
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.exit(0);
}

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    if (key === '\u0003' || key === 'q' || key === 'Q') {
      cleanup();
    }

    let changed = false;
    switch (key) {
      case '\u001b[D': // left arrow
      case 'l':
      case 'L':
        changed = moveLeft();
        break;
      case '\u001b[C': // right arrow
      case 'r':
      case 'R':
        changed = moveRight();
        break;
      case '\u001b[B': // down arrow
      case 'd':
      case 'D':
        changed = moveDown();
        break;
      case '\u001b[A': // up arrow
      case 'u':
      case 'U':
        changed = rotate('cw');
        break;
      default:
        break;
    }

    if (changed) draw();
  });

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

spawnPiece();
draw();

if (!process.stdin.isTTY) {
  process.stdout.write(SHOW_CURSOR + '\n');
  process.exit(0);
}
