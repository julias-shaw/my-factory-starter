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

function draw() {
  const topBorder = `${TL}${H.repeat(BOARD_WIDTH)}${TR}`;
  const bottomBorder = `${BL}${H.repeat(BOARD_WIDTH)}${BR}`;
  const emptyRow = `${V}${EMPTY.repeat(BOARD_WIDTH)}${V}`;

  const sidePanel = [
    'SCORE: 0',
    'LINES: 0',
    'LEVEL: 1',
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
    const side = sidePanel[r + 1] || '';
    rows.push(`${emptyRow}  ${side}`);
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

draw();

if (!process.stdin.isTTY) {
  process.stdout.write(SHOW_CURSOR + '\n');
  process.exit(0);
}
