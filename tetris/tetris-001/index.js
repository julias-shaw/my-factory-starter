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
