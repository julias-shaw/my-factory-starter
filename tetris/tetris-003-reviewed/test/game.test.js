import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_TYPES,
  TetrisGame,
  createEmptyBoard,
} from '../src/game.js';

function createGame(options = {}) {
  return new TetrisGame({ random: () => 0, ...options });
}

test('each seven-piece bag contains every tetromino exactly once', () => {
  const game = createGame();
  const dealt = [game.active.type, game.nextType];

  while (game.bag.length > 0) dealt.push(game.drawType());

  assert.equal(game.width, BOARD_WIDTH);
  assert.equal(game.height, BOARD_HEIGHT);
  assert.equal(dealt.length, PIECE_TYPES.length);
  assert.deepEqual([...dealt].sort(), [...PIECE_TYPES].sort());
  assert.equal(new Set(dealt).size, PIECE_TYPES.length);
});

test('movement, rotation, and collision respect walls and locked cells', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 0, y: 0 };

  assert.equal(game.moveLeft(), false);
  assert.deepEqual(game.active, { type: 'O', rotation: 0, x: 0, y: 0 });
  assert.equal(game.moveRight(), true);
  assert.equal(game.active.x, 1);

  game.active = { type: 'O', rotation: 0, x: 0, y: 0 };
  game.board[0][1] = 'I';
  assert.equal(game.moveRight(), false, 'a locked cell blocks horizontal movement');
  game.board = createEmptyBoard();
  assert.equal(game.move(0, -1), true, 'cells above the visible board are permitted');
  assert.equal(game.active.y, -1);

  game.active = { type: 'T', rotation: 0, x: 3, y: 0 };
  assert.equal(game.rotate(), true);
  assert.equal(game.active.rotation, 1);
  assert.deepEqual(game.getCells(), [[4, 0], [4, 1], [5, 1], [4, 2]]);
  assert.equal(game.rotate(-1), true);
  assert.equal(game.active.rotation, 0);
  assert.deepEqual(game.getCells(), [[4, 0], [3, 1], [4, 1], [5, 1]]);
});

test('gravity and soft drop move down, while blocked gravity locks without points', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 4, y: 0 };

  assert.equal(game.tick(), true);
  assert.equal(game.active.y, 1);
  assert.equal(game.score, 0);
  assert.equal(game.moveDown(), true);
  assert.equal(game.active.y, 2);
  assert.equal(game.score, 1);

  game.active = { type: 'O', rotation: 0, x: 4, y: BOARD_HEIGHT - 2 };
  const score = game.score;
  assert.equal(game.tick(), false);
  assert.equal(game.score, score);
  assert.equal(game.board[BOARD_HEIGHT - 1][4], 'O');
  assert.equal(game.board[BOARD_HEIGHT - 1][5], 'O');
  assert.equal(game.status, 'playing');
  assert.ok(game.active, 'locking spawns the next piece');
});

test('hard drop awards two points per row and locks at the lowest valid position', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 4, y: 0 };

  assert.equal(game.hardDrop(), BOARD_HEIGHT - 2);
  assert.equal(game.score, (BOARD_HEIGHT - 2) * 2);
  assert.equal(game.board[BOARD_HEIGHT - 2][4], 'O');
  assert.equal(game.board[BOARD_HEIGHT - 1][5], 'O');
  assert.ok(game.active);
});

test('locking a piece clears complete rows and updates score and line count', () => {
  const game = createGame({ width: 4, height: 4 });
  game.active = { type: 'O', rotation: 0, x: 1, y: 0 };
  game.board[3] = ['I', null, null, 'I'];

  assert.equal(game.hardDrop(), 2);
  assert.equal(game.score, 104, 'four drop points plus 100 line-clear points');
  assert.equal(game.lines, 1);
  assert.equal(game.level, 1);
  assert.deepEqual(game.board, [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, 'O', 'O', null],
  ]);
});

test('line clears advance the level and gravity interval', () => {
  const game = createGame({ width: 4, height: 4 });
  game.active = { type: 'I', rotation: 0, x: 0, y: 0 };
  game.lines = 9;

  assert.equal(game.gravityInterval, 800);
  game.hardDrop();
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
  assert.equal(game.gravityInterval, 680);
});

test('a blocked spawn enters game over and restart resets all state', () => {
  const game = createGame();
  game.nextType = 'O';
  game.board[0][4] = 'I';
  game.score = 500;
  game.lines = 12;

  assert.equal(game.spawn(), false);
  assert.equal(game.gameOver, true);
  assert.equal(game.status, 'game-over');
  assert.equal(game.active, null);
  assert.equal(game.moveLeft(), false);

  game.restart();
  assert.equal(game.status, 'playing');
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.ok(game.active);
  assert.deepEqual(game.board, createEmptyBoard());
});

test('locking above the board ends the game and quit can be restarted', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 4, y: -1 };

  assert.equal(game.lockPiece(), false);
  assert.equal(game.gameOver, true);
  assert.deepEqual(game.board, createEmptyBoard());
  assert.equal(game.tick(), false);
  assert.equal(game.hardDrop(), 0);

  game.restart();
  game.quit();
  assert.equal(game.status, 'quit');
  assert.equal(game.active, null);
  game.action('restart');
  assert.equal(game.status, 'playing');
  assert.ok(game.active);
});
