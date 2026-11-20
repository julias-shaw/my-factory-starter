// Core Tetris game logic. Pure state + rules; no terminal I/O.

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Rotation states for each tetromino (SRS orientation), as [x, y] cells
// within the piece's bounding box. y grows downward.
const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

// SRS wall-kick offsets, [dx, dy] with y downward. Keyed "from>to".
const KICKS_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

const KICKS_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

// Base points for clearing 1-4 lines at once, multiplied by level.
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const LINES_PER_LEVEL = 10;

export function pieceCells(piece) {
  return SHAPES[piece.type][piece.rotation].map(([x, y]) => [piece.x + x, piece.y + y]);
}

export function createBoard(width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

// Gravity interval in milliseconds for a level; speeds up and floors at 50ms.
export function dropInterval(level) {
  return Math.max(50, Math.round(1000 * Math.pow(0.85, level - 1)));
}

// 7-bag randomizer: every piece appears once per bag of seven.
export function createBag(random = Math.random) {
  let bag = [];
  return () => {
    if (bag.length === 0) {
      bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  };
}

export class Game {
  constructor({ random = Math.random, width = BOARD_WIDTH, height = BOARD_HEIGHT } = {}) {
    this.random = random;
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.board = createBoard(this.width, this.height);
    this.nextType = createBag(this.random);
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.paused = false;
    this.lastClear = 0;
    this.next = this.nextType();
    this.current = null;
    this.spawn();
  }

  spawn(type = null) {
    const pieceType = type ?? this.next;
    if (type === null) this.next = this.nextType();
    const piece = {
      type: pieceType,
      rotation: 0,
      x: Math.floor((this.width - 4) / 2),
      y: 0,
    };
    this.current = piece;
    if (!this.fits(piece)) {
      this.gameOver = true;
      return false;
    }
    return true;
  }

  fits(piece) {
    return pieceCells(piece).every(
      ([x, y]) =>
        x >= 0 && x < this.width && y >= 0 && y < this.height && this.board[y][x] === null,
    );
  }

  get active() {
    return !this.gameOver && !this.paused;
  }

  tryMove(dx, dy) {
    if (!this.active) return false;
    const moved = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (!this.fits(moved)) return false;
    this.current = moved;
    return true;
  }

  moveLeft() {
    return this.tryMove(-1, 0);
  }

  moveRight() {
    return this.tryMove(1, 0);
  }

  rotate(direction = 1) {
    if (!this.active) return false;
    const from = this.current.rotation;
    const to = (from + (direction > 0 ? 1 : 3)) % 4;
    if (this.current.type === 'O') return true;
    const kicks = (this.current.type === 'I' ? KICKS_I : KICKS_JLSTZ)[`${from}>${to}`];
    for (const [dx, dy] of kicks) {
      const candidate = { ...this.current, rotation: to, x: this.current.x + dx, y: this.current.y + dy };
      if (this.fits(candidate)) {
        this.current = candidate;
        return true;
      }
    }
    return false;
  }

  rotateClockwise() {
    return this.rotate(1);
  }

  rotateCounterClockwise() {
    return this.rotate(-1);
  }

  // One step of gravity: move down, or lock the piece if it cannot move.
  tick() {
    if (!this.active) return;
    if (!this.tryMove(0, 1)) this.lock();
  }

  softDrop() {
    if (!this.active) return false;
    if (this.tryMove(0, 1)) {
      this.score += 1;
      return true;
    }
    this.lock();
    return false;
  }

  hardDrop() {
    if (!this.active) return 0;
    let distance = 0;
    while (this.tryMove(0, 1)) distance++;
    this.score += distance * 2;
    this.lock();
    return distance;
  }

  // Row the current piece would land on if hard-dropped.
  ghost() {
    if (!this.current) return null;
    let piece = this.current;
    for (;;) {
      const below = { ...piece, y: piece.y + 1 };
      if (!this.fits(below)) return piece;
      piece = below;
    }
  }

  lock() {
    for (const [x, y] of pieceCells(this.current)) {
      this.board[y][x] = this.current.type;
    }
    const cleared = this.clearLines();
    this.lastClear = cleared;
    if (cleared > 0) {
      this.score += LINE_SCORES[cleared] * this.level;
      this.lines += cleared;
      this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
    }
    this.spawn();
  }

  clearLines() {
    const remaining = this.board.filter((row) => row.some((cell) => cell === null));
    const cleared = this.height - remaining.length;
    const empty = Array.from({ length: cleared }, () => Array(this.width).fill(null));
    this.board = [...empty, ...remaining];
    return cleared;
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
  }

  get interval() {
    return dropInterval(this.level);
  }
}
