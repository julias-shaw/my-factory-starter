'use strict';

const { createBoard, renderGame } = require('./board');

const board = createBoard();
const activePiece = {
  type: 'T',
  x: 4,
  y: 0,
  cells: [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
};

process.stdout.write(renderGame({ board, activePiece, score: 0 }));
