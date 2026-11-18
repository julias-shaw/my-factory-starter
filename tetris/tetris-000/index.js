'use strict';

const readline = require('node:readline');

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]],
};

function createPiece(random = Math.random) {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(random() * types.length)];
  const shape = SHAPES[type].map(row => [...row]);
  return {
    type,
    shape,
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: 0,
  };
}

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function canPlace(board, piece, x = piece.x, y = piece.y) {
  return piece.shape.every((row, dy) => row.every((cell, dx) => {
    if (!cell) return true;
    const boardX = x + dx;
    const boardY = y + dy;
    return boardX >= 0 && boardX < BOARD_WIDTH &&
      boardY >= 0 && boardY < BOARD_HEIGHT &&
      board[boardY][boardX] === null;
  }));
}

function movePiece(board, piece, dx) {
  if (!canPlace(board, piece, piece.x + dx, piece.y)) return false;
  piece.x += dx;
  return true;
}

function rotatePiece(board, piece) {
  const shape = piece.shape[0].map((_, x) =>
    piece.shape.map(row => row[x]).reverse());
  const rotated = { ...piece, shape };
  // Compact matrices need up to three columns of adjustment for the I piece.
  for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
    if (!canPlace(board, rotated, piece.x + dx, piece.y)) continue;
    piece.shape = shape;
    piece.x += dx;
    return true;
  }
  return false;
}

function advancePiece(board, piece, random = Math.random) {
  if (canPlace(board, piece, piece.x, piece.y + 1)) {
    piece.y += 1;
    return piece;
  }

  piece.shape.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      if (cell) board[piece.y + dy][piece.x + dx] = piece.type;
    });
  });
  const next = createPiece(random);
  return canPlace(board, next) ? next : null;
}

function hardDrop(board, piece, random = Math.random) {
  while (canPlace(board, piece, piece.x, piece.y + 1)) {
    piece.y += 1;
  }
  return advancePiece(board, piece, random);
}

function render(board, score = 0, activePiece = null) {
  const display = board.map(row => [...row]);
  if (activePiece) {
    activePiece.shape.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        const x = activePiece.x + dx;
        const y = activePiece.y + dy;
        if (cell && y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
          display[y][x] = activePiece.type;
        }
      });
    });
  }
  const border = `+${'-'.repeat(BOARD_WIDTH * 2)}+`;
  return [
    `TETRIS  |  Score: ${score}`,
    border,
    ...display.map(row => `|${row.map(cell => cell === null ? '  ' : '[]').join('')}|`),
    border,
    'Left/Right: move  Up: rotate  Down: soft drop  Space: hard drop',
  ].join('\n');
}

function main() {
  const board = createBoard();
  let piece = createPiece();
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stdout.write(`${render(board, 0, piece)}\n`);
    return;
  }

  const draw = () => process.stdout.write(`\x1b[H${render(board, 0, piece)}`);
  const wasRaw = process.stdin.isRaw;
  let fallTimer;
  const cleanup = () => {
    clearInterval(fallTimer);
    process.stdin.removeListener('keypress', onKey);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    process.stdin.setRawMode(Boolean(wasRaw));
    process.stdin.pause();
    process.stdout.write('\x1b[24;1H\n');
  };
  const stop = () => {
    cleanup();
  };
  const onKey = (text, key = {}) => {
    if (key.ctrl && key.name === 'c') {
      stop();
      return;
    }
    const dx = key.name === 'left' ? -1 : key.name === 'right' ? 1 : 0;
    if (piece && dx && movePiece(board, piece, dx)) draw();
    if (piece && key.name === 'up' && rotatePiece(board, piece)) draw();
    if (piece && (key.name === 'down' || key.name === 'space')) {
      piece = key.name === 'space' ? hardDrop(board, piece) : advancePiece(board, piece);
      if (!piece) clearInterval(fallTimer);
      draw();
    }
  };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', onKey);
  process.stdin.resume();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.stdout.write('\x1b[2J');
  draw();
  fallTimer = setInterval(() => {
    if (!piece) return;
    piece = advancePiece(board, piece);
    if (!piece) clearInterval(fallTimer);
    draw();
  }, 700);
}

if (require.main === module) {
  main();
}

module.exports = {
  BOARD_WIDTH, BOARD_HEIGHT, SHAPES, createBoard, createPiece, canPlace, movePiece,
  rotatePiece, advancePiece, hardDrop, render,
};
