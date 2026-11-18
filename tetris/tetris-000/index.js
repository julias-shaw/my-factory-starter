'use strict';

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
    'Arrows: move/rotate  Space: drop  P: pause  Q: quit',
  ].join('\n');
}

function main() {
  process.stdout.write(`${render(createBoard(), 0, createPiece())}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { BOARD_WIDTH, BOARD_HEIGHT, SHAPES, createBoard, createPiece, render };
