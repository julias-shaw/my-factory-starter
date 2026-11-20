'use strict';

const TETROMINO_TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

const BASE_SHAPES = {
  I: {
    size: 4,
    color: 'cyan',
    spawn: { x: 3, y: 0 },
    cells: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
  },
  O: {
    size: 2,
    color: 'yellow',
    spawn: { x: 4, y: 0 },
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  T: {
    size: 3,
    color: 'magenta',
    spawn: { x: 3, y: 0 },
    cells: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  S: {
    size: 3,
    color: 'green',
    spawn: { x: 3, y: 0 },
    cells: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  Z: {
    size: 3,
    color: 'red',
    spawn: { x: 3, y: 0 },
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  J: {
    size: 3,
    color: 'blue',
    spawn: { x: 3, y: 0 },
    cells: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  L: {
    size: 3,
    color: 'orange',
    spawn: { x: 3, y: 0 },
    cells: [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
};

function rotateCellsClockwise(cells, size) {
  return cells.map(({ x, y }) => ({ x: size - 1 - y, y: x }));
}

function buildRotations(shape) {
  const rotations = [shape.cells];
  for (let rotation = 1; rotation < 4; rotation += 1) {
    rotations.push(rotateCellsClockwise(rotations[rotation - 1], shape.size));
  }
  return rotations;
}

const TETROMINOES = Object.freeze(
  Object.fromEntries(
    TETROMINO_TYPES.map((type) => {
      const shape = BASE_SHAPES[type];
      return [type, Object.freeze({
        type,
        color: shape.color,
        spawn: Object.freeze({ ...shape.spawn }),
        rotations: Object.freeze(buildRotations(shape).map(
          (cells) => Object.freeze(cells.map((cell) => Object.freeze(cell))),
        )),
      })];
    }),
  ),
);

/**
 * Super Rotation System kick offsets. Offset Y values use the conventional
 * positive-up coordinates and are inverted when applied to the board.
 */
const JLSTZ_KICKS = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const I_KICKS = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

const NO_KICKS = [[0, 0]];

function createPiece(type) {
  const definition = TETROMINOES[type];
  if (!definition) {
    throw new RangeError(`Unknown tetromino type: ${type}`);
  }

  return {
    type,
    color: definition.color,
    x: definition.spawn.x,
    y: definition.spawn.y,
    rotation: 0,
    cells: definition.rotations[0].map((cell) => ({ ...cell })),
  };
}

/**
 * Test a piece position without mutating it. Cells above the board are valid,
 * which allows pieces to spawn and rotate partly outside the visible field.
 */
function canPlace(board, piece, position = {}) {
  const x = position.x === undefined ? piece.x : position.x;
  const y = position.y === undefined ? piece.y : position.y;
  const cells = position.cells || piece.cells;

  return cells.every((cell) => {
    const boardX = x + cell.x;
    const boardY = y + cell.y;

    if (boardX < 0 || boardX >= board[0].length || boardY >= board.length) {
      return false;
    }
    if (boardY < 0) {
      return true;
    }
    return board[boardY][boardX] === null;
  });
}

function copyPieceAt(piece, x, y, cells = piece.cells, rotation = piece.rotation) {
  return { ...piece, x, y, cells, rotation };
}

/** Return the moved piece, or null when the requested move is blocked. */
function movePiece(board, piece, dx, dy) {
  const x = piece.x + dx;
  const y = piece.y + dy;
  return canPlace(board, piece, { x, y }) ? copyPieceAt(piece, x, y) : null;
}

function softDrop(board, piece) {
  return movePiece(board, piece, 0, 1);
}

/** Return a new piece at the lowest valid position. */
function hardDrop(board, piece) {
  let dropped = copyPieceAt(piece, piece.x, piece.y);
  while (true) {
    const next = movePiece(board, dropped, 0, 1);
    if (next === null) {
      return dropped;
    }
    dropped = next;
  }
}

/**
 * Rotate clockwise (1) or counter-clockwise (-1), trying SRS wall kicks.
 * Returns the rotated piece, or null if every candidate position is blocked.
 */
function rotatePiece(board, piece, direction = 1) {
  if (direction !== 1 && direction !== -1) {
    throw new RangeError('Rotation direction must be 1 or -1');
  }

  const fromRotation = piece.rotation;
  const toRotation = (fromRotation + direction + 4) % 4;
  const cells = TETROMINOES[piece.type].rotations[toRotation];
  let kicks = NO_KICKS;
  if (piece.type === 'I') {
    kicks = I_KICKS[`${fromRotation}>${toRotation}`];
  } else if (piece.type !== 'O') {
    kicks = JLSTZ_KICKS[`${fromRotation}>${toRotation}`];
  }

  for (const [kickX, kickY] of kicks) {
    const x = piece.x + kickX;
    const y = piece.y - kickY;
    if (canPlace(board, piece, { x, y, cells })) {
      return copyPieceAt(piece, x, y, cells.map((cell) => ({ ...cell })), toRotation);
    }
  }

  return null;
}

module.exports = {
  TETROMINO_TYPES,
  TETROMINOES,
  createPiece,
  canPlace,
  movePiece,
  softDrop,
  hardDrop,
  rotatePiece,
};
