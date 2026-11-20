export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

const SHAPES = {
  I: {
    color: 'cyan',
    matrix: [
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  J: {
    color: 'blue',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: 'orange',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  O: {
    color: 'yellow',
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  S: {
    color: 'green',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  T: {
    color: 'magenta',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  Z: {
    color: 'red',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
};

function rotateMatrix(matrix) {
  return matrix[0].map((_, x) => matrix.map((row) => row[x]).reverse());
}

function matrixCells(matrix) {
  const cells = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (matrix[y][x]) cells.push(Object.freeze([x, y]));
    }
  }
  return Object.freeze(cells);
}

function makeRotations(matrix) {
  const rotations = [matrix];
  for (let index = 1; index < 4; index += 1) {
    rotations.push(rotateMatrix(rotations[index - 1]));
  }
  return Object.freeze(rotations.map(matrixCells));
}

/** Immutable shape, colour, and rotation data for all seven tetrominoes. */
export const TETROMINOES = Object.freeze(
  Object.fromEntries(
    Object.entries(SHAPES).map(([type, { color, matrix }]) => [
      type,
      Object.freeze({ color, size: matrix.length, rotations: makeRotations(matrix) }),
    ]),
  ),
);

export const PIECE_TYPES = Object.freeze(Object.keys(TETROMINOES));

export function createEmptyBoard(width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

/**
 * Pure Tetris game state. Time and input are supplied by the caller through
 * tick() and the movement/action methods, making the mechanics deterministic
 * and independent of the terminal renderer.
 */
export class TetrisGame {
  constructor({ width = BOARD_WIDTH, height = BOARD_HEIGHT, random = Math.random } = {}) {
    if (!Number.isInteger(width) || width < 4 || !Number.isInteger(height) || height < 4) {
      throw new RangeError('Board dimensions must be integers of at least 4 by 4');
    }
    if (typeof random !== 'function') throw new TypeError('random must be a function');

    this.width = width;
    this.height = height;
    this.random = random;
    this.restart();
  }

  get gameOver() {
    return this.status === 'game-over';
  }

  get gravityInterval() {
    return Math.max(50, Math.round(800 * 0.85 ** (this.level - 1)));
  }

  /** Start a fresh game, including after quitting or game over. */
  restart() {
    this.board = createEmptyBoard(this.width, this.height);
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.status = 'playing';
    this.active = null;
    this.bag = [];
    this.nextType = this.drawType();
    this.spawn();
    return this;
  }

  /** End the current session. restart() can subsequently start a new game. */
  quit() {
    this.status = 'quit';
    this.active = null;
  }

  /** Refill and shuffle a seven-piece bag when necessary. */
  drawType() {
    if (this.bag.length === 0) {
      this.bag = [...PIECE_TYPES];
      for (let index = this.bag.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.min(index, Math.floor(this.random() * (index + 1)));
        [this.bag[index], this.bag[randomIndex]] = [this.bag[randomIndex], this.bag[index]];
      }
    }
    return this.bag.pop();
  }

  /** Spawn the preview piece at the top centre, or enter the game-over state. */
  spawn() {
    if (this.status !== 'playing') return false;

    const type = this.nextType ?? this.drawType();
    this.nextType = this.drawType();
    const definition = TETROMINOES[type];
    const candidate = {
      type,
      rotation: 0,
      x: Math.floor((this.width - definition.size) / 2),
      y: 0,
    };

    if (this.collides(candidate)) {
      this.active = null;
      this.status = 'game-over';
      return false;
    }

    this.active = candidate;
    return true;
  }

  /** Return board coordinates for a piece (or the active piece by default). */
  getCells(piece = this.active) {
    if (!piece) return [];
    return TETROMINOES[piece.type].rotations[piece.rotation].map(([x, y]) => [
      piece.x + x,
      piece.y + y,
    ]);
  }

  /** Test boundaries and locked blocks; cells above the board are permitted. */
  collides(piece) {
    if (!piece) return false;
    return this.getCells(piece).some(([x, y]) => {
      if (x < 0 || x >= this.width || y >= this.height) return true;
      return y >= 0 && this.board[y][x] !== null;
    });
  }

  /** Move the active piece by a relative offset without locking it. */
  move(dx, dy) {
    if (this.status !== 'playing' || !this.active) return false;
    const candidate = { ...this.active, x: this.active.x + dx, y: this.active.y + dy };
    if (this.collides(candidate)) return false;
    this.active = candidate;
    return true;
  }

  moveLeft() {
    return this.move(-1, 0);
  }

  moveRight() {
    return this.move(1, 0);
  }

  /** Soft-drop one row, awarding one point, and lock when movement is blocked. */
  moveDown() {
    if (this.status !== 'playing' || !this.active) return false;
    const moved = this.tick();
    if (moved) this.score += 1;
    return moved;
  }

  /** Apply gravity without awarding soft-drop points. */
  tick() {
    if (this.status !== 'playing' || !this.active) return false;
    if (this.move(0, 1)) return true;
    this.lockPiece();
    return false;
  }

  /** Drop to the lowest valid position, award two points per row, and lock. */
  hardDrop() {
    if (this.status !== 'playing' || !this.active) return 0;
    let distance = 0;
    while (this.move(0, 1)) distance += 1;
    this.score += distance * 2;
    this.lockPiece();
    return distance;
  }

  /** Rotate clockwise (or anticlockwise with -1), trying simple wall kicks. */
  rotate(direction = 1) {
    if (this.status !== 'playing' || !this.active) return false;
    const rotation = (this.active.rotation + (direction < 0 ? 3 : 1)) % 4;
    const kicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
      [-1, -1],
      [1, -1],
      [0, -2],
      [0, 1],
    ];

    for (const [dx, dy] of kicks) {
      const candidate = {
        ...this.active,
        rotation,
        x: this.active.x + dx,
        y: this.active.y + dy,
      };
      if (!this.collides(candidate)) {
        this.active = candidate;
        return true;
      }
    }
    return false;
  }

  /** Lock the active piece, clear complete rows, update score, and spawn. */
  lockPiece() {
    if (this.status !== 'playing' || !this.active) return false;
    const cells = this.getCells();

    // A piece that locks above the visible board causes game over.
    if (cells.some(([, y]) => y < 0)) {
      this.active = null;
      this.status = 'game-over';
      return false;
    }

    for (const [x, y] of cells) this.board[y][x] = this.active.type;
    this.active = null;
    const cleared = this.clearLines();
    const linePoints = [0, 100, 300, 500, 800];
    this.score += linePoints[cleared] * this.level;
    this.lines += cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    this.spawn();
    return true;
  }

  /** Remove full rows and return the number removed. */
  clearLines() {
    const remaining = this.board.filter((row) => row.some((cell) => cell === null));
    const cleared = this.height - remaining.length;
    while (remaining.length < this.height) {
      remaining.unshift(Array(this.width).fill(null));
    }
    this.board = remaining;
    return cleared;
  }

  /** Return a copy of the board, optionally with the active piece overlaid. */
  getBoard({ includeActive = true } = {}) {
    const board = this.board.map((row) => [...row]);
    if (includeActive) {
      for (const [x, y] of this.getCells()) {
        if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
          board[y][x] = this.active.type;
        }
      }
    }
    return board;
  }

  /** Map renderer-independent control names to game actions. */
  action(name) {
    switch (name) {
      case 'left': return this.moveLeft();
      case 'right': return this.moveRight();
      case 'down': return this.moveDown();
      case 'rotate': return this.rotate(1);
      case 'rotate-ccw': return this.rotate(-1);
      case 'drop': return this.hardDrop();
      case 'tick': return this.tick();
      case 'restart': return this.restart();
      case 'quit': return this.quit();
      default: return false;
    }
  }
}

export default TetrisGame;
