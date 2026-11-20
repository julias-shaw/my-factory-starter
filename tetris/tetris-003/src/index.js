'use strict';

const { createBoard, renderGame } = require('./board');
const { createPiece } = require('./tetrominoes');

const board = createBoard();
const activePiece = createPiece('T');

process.stdout.write(renderGame({ board, activePiece, score: 0 }));
