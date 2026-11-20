'use strict';

const { createBoard, BOARD_HEIGHT, BOARD_WIDTH } = require('./board');
const {
  TETROMINO_TYPES,
  createPiece,
  canPlace,
  movePiece,
  rotatePiece,
  softDrop: movePieceDown,
  hardDrop: dropPieceToBottom,
} = require('./tetrominoes');

const LINE_SCORES = Object.freeze([0, 100, 300, 500, 800]);
const LINES_PER_LEVEL = 10;
const DEFAULT_TICK_INTERVAL = 800;
const MIN_TICK_INTERVAL = 80;

/** Return a board with completed rows removed and empty rows added above. */
function clearCompletedLines(board) {
  const remainingRows = board
    .filter((row) => row.some((cell) => cell === null))
    .map((row) => row.slice());
  const linesCleared = board.length - remainingRows.length;
  const emptyRows = Array.from(
    { length: linesCleared },
    () => Array(BOARD_WIDTH).fill(null),
  );

  return {
    board: [...emptyRows, ...remainingRows],
    linesCleared,
  };
}

function scoreForLines(linesCleared, level) {
  if (!Number.isInteger(linesCleared) || linesCleared < 0 || linesCleared > 4) {
    throw new RangeError('A Tetris lock can clear between zero and four lines');
  }
  return LINE_SCORES[linesCleared] * level;
}

/** Gravity accelerates after every ten cleared lines, down to a safe minimum. */
function tickIntervalForLevel(level, initialInterval = DEFAULT_TICK_INTERVAL) {
  return Math.max(
    MIN_TICK_INTERVAL,
    Math.round(initialInterval * (0.85 ** (level - 1))),
  );
}

class TetrisGame {
  constructor({
    rng = Math.random,
    initialTickInterval = DEFAULT_TICK_INTERVAL,
  } = {}) {
    if (!Number.isFinite(initialTickInterval) || initialTickInterval <= 0) {
      throw new RangeError('initialTickInterval must be a positive number');
    }

    this.rng = rng;
    this.initialTickInterval = initialTickInterval;
    this.timer = null;
    this.reset();
  }

  reset() {
    this.stop();
    this.board = createBoard();
    this.activePiece = null;
    this.nextType = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.status = 'playing';
    this.bag = [];
    this.nextType = this.takeFromBag();
    this.spawnNextPiece();
    return this;
  }

  /** A shuffled seven-bag keeps the random sequence fair and deterministic in tests. */
  takeFromBag() {
    if (this.bag.length === 0) {
      this.bag = TETROMINO_TYPES.slice();
      for (let index = this.bag.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.min(
          index,
          Math.floor(this.rng() * (index + 1)),
        );
        [this.bag[index], this.bag[randomIndex]] = [
          this.bag[randomIndex],
          this.bag[index],
        ];
      }
    }
    return this.bag.pop();
  }

  get tickInterval() {
    return tickIntervalForLevel(this.level, this.initialTickInterval);
  }

  spawnNextPiece() {
    const piece = createPiece(this.nextType);
    this.nextType = this.takeFromBag();

    if (!canPlace(this.board, piece)) {
      this.activePiece = null;
      this.status = 'gameOver';
      this.stop();
      return false;
    }

    this.activePiece = piece;
    return true;
  }

  lockActivePiece() {
    if (this.status !== 'playing' || this.activePiece === null) {
      return 0;
    }

    for (const cell of this.activePiece.cells) {
      const x = this.activePiece.x + cell.x;
      const y = this.activePiece.y + cell.y;
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
        this.board[y][x] = this.activePiece.type;
      }
    }

    const result = clearCompletedLines(this.board);
    this.board = result.board;
    this.score += scoreForLines(result.linesCleared, this.level);
    this.lines += result.linesCleared;
    this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
    this.spawnNextPiece();
    return result.linesCleared;
  }

  /** Advance gravity once; a blocked piece locks and the next piece spawns. */
  tick() {
    if (this.status !== 'playing') {
      return this;
    }

    const dropped = movePieceDown(this.board, this.activePiece);
    if (dropped === null) {
      this.lockActivePiece();
    } else {
      this.activePiece = dropped;
    }
    return this;
  }

  move(dx, dy = 0) {
    if (this.status !== 'playing' || this.activePiece === null) {
      return false;
    }

    const moved = movePiece(this.board, this.activePiece, dx, dy);
    if (moved === null) {
      return false;
    }
    this.activePiece = moved;
    return true;
  }

  rotate(direction = 1) {
    if (this.status !== 'playing' || this.activePiece === null) {
      return false;
    }

    const rotated = rotatePiece(this.board, this.activePiece, direction);
    if (rotated === null) {
      return false;
    }
    this.activePiece = rotated;
    return true;
  }

  softDrop() {
    if (this.status !== 'playing') {
      return false;
    }

    const dropped = movePieceDown(this.board, this.activePiece);
    if (dropped === null) {
      this.lockActivePiece();
      return false;
    }

    this.activePiece = dropped;
    this.score += 1;
    return true;
  }

  hardDrop() {
    if (this.status !== 'playing') {
      return 0;
    }

    const dropped = dropPieceToBottom(this.board, this.activePiece);
    const distance = dropped.y - this.activePiece.y;
    this.activePiece = dropped;
    this.score += distance * 2;
    this.lockActivePiece();
    return distance;
  }

  pause() {
    if (this.status !== 'playing') {
      return false;
    }
    this.status = 'paused';
    this.stop();
    return true;
  }

  resume(onUpdate = () => {}) {
    if (this.status !== 'paused') {
      return false;
    }
    this.status = 'playing';
    this.start(onUpdate);
    return true;
  }

  togglePause(onUpdate = () => {}) {
    if (this.status === 'playing') {
      return this.pause();
    }
    return this.resume(onUpdate);
  }

  restart(onUpdate = () => {}) {
    this.reset();
    this.start(onUpdate);
    return this;
  }

  /** Start a self-rescheduling loop so a level-up changes the very next delay. */
  start(onUpdate = () => {}) {
    if (this.timer !== null || this.status !== 'playing') {
      return;
    }

    const run = () => {
      this.timer = null;
      this.tick();
      onUpdate(this);
      if (this.status === 'playing') {
        this.timer = setTimeout(run, this.tickInterval);
      }
    };

    this.timer = setTimeout(run, this.tickInterval);
  }

  stop() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

module.exports = {
  LINE_SCORES,
  LINES_PER_LEVEL,
  DEFAULT_TICK_INTERVAL,
  MIN_TICK_INTERVAL,
  TetrisGame,
  clearCompletedLines,
  scoreForLines,
  tickIntervalForLevel,
};
