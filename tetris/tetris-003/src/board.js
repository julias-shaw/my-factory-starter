'use strict';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_WIDTH = 2;
const TOTAL_ROWS = 24;
const { TETROMINOES } = require('./tetrominoes');

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function cellText(value) {
  return value === null ? '..' : '[]';
}

function nextPiecePreview(type) {
  const rows = Array.from({ length: 4 }, () => Array(4).fill('  '));
  const definition = TETROMINOES[type];
  if (!definition) {
    return rows.map((row) => row.join(''));
  }

  const cells = definition.rotations[0];
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  for (const cell of cells) {
    rows[cell.y - minY][cell.x - minX] = '[]';
  }
  return rows.map((row) => row.join(''));
}

/**
 * Render a complete 24-row frame: two information rows and a bordered 10x20 board.
 */
function renderGame({ board, activePiece, nextType, score = 0, level = 1 }) {
  const cells = board.map((row) => row.slice());

  if (activePiece) {
    for (const cell of activePiece.cells) {
      const x = activePiece.x + cell.x;
      const y = activePiece.y + cell.y;
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
        cells[y][x] = activePiece.type;
      }
    }
  }

  const horizontalBorder = `+${'-'.repeat(BOARD_WIDTH * CELL_WIDTH)}+`;
  const preview = nextPiecePreview(nextType);
  const boardRows = cells.map(
    (row, index) => `|${row.map(cellText).join('')}|${index < 4 ? `  ${preview[index]}` : ''}`,
  );

  return [
    `Score: ${score} | Level: ${level}`,
    'Controls: arrows move/drop | Z/X rotate | Space hard drop | P pause | Q quit',
    `${horizontalBorder}  Next:`,
    ...boardRows,
    horizontalBorder,
  ].join('\n');
}

module.exports = {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  TOTAL_ROWS,
  createBoard,
  renderGame,
};
