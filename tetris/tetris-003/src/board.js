'use strict';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_WIDTH = 2;
const TOTAL_ROWS = 24;

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function cellText(value) {
  return value === null ? '..' : '[]';
}

/**
 * Render a complete 24-row frame: two information rows and a bordered 10x20 board.
 */
function renderGame({ board, activePiece, score = 0 }) {
  const cells = board.map((row) => row.slice());

  for (const cell of activePiece.cells) {
    const x = activePiece.x + cell.x;
    const y = activePiece.y + cell.y;
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      cells[y][x] = activePiece.type;
    }
  }

  const horizontalBorder = `+${'-'.repeat(BOARD_WIDTH * CELL_WIDTH)}+`;
  const boardRows = cells.map(
    (row) => `|${row.map(cellText).join('')}|`,
  );

  return [
    `Score: ${score}`,
    'Controls: arrows move/drop | Z/X rotate | Space hard drop | P pause | Q quit',
    horizontalBorder,
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
