'use strict';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function render(board, score = 0) {
  const border = `+${'-'.repeat(BOARD_WIDTH * 2)}+`;
  return [
    `TETRIS  |  Score: ${score}`,
    border,
    ...board.map(row => `|${row.map(cell => cell === null ? '  ' : '[]').join('')}|`),
    border,
    'Arrows: move/rotate  Space: drop  P: pause  Q: quit',
  ].join('\n');
}

function main() {
  process.stdout.write(`${render(createBoard())}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { BOARD_WIDTH, BOARD_HEIGHT, createBoard, render };
