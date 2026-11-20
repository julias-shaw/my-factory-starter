import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_HEIGHT, BOARD_WIDTH, PIECE_TYPES, ROTATIONS, createBag, createGame, gravityInterval, pieceCells,
} from '../src/game.js';
import { createApp } from '../src/app.js';

function sequence(...types) {
  let i = 0;
  return () => types[i++ % types.length];
}

test('there are seven tetrominoes, each four cells in every rotation', () => {
  assert.deepEqual([...PIECE_TYPES].sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  for (const type of PIECE_TYPES) {
    assert.equal(ROTATIONS[type].length, 4);
    for (const cells of ROTATIONS[type]) assert.equal(cells.length, 4);
  }
});

test('7-bag randomizer yields every piece once per seven draws', () => {
  const next = createBag(() => 0.5);
  const first = Array.from({ length: 7 }, next).sort();
  const second = Array.from({ length: 7 }, next).sort();
  assert.deepEqual(first, [...PIECE_TYPES].sort());
  assert.deepEqual(second, [...PIECE_TYPES].sort());
});

test('pieces move left/right and stop at the walls', () => {
  const g = createGame({ nextPiece: sequence('O') });
  const startX = g.state.current.x;
  assert.equal(g.moveLeft(), true);
  assert.equal(g.state.current.x, startX - 1);
  while (g.moveLeft());
  assert.equal(Math.min(...pieceCells(g.state.current).map(([x]) => x)), 0);
  while (g.moveRight());
  assert.equal(Math.max(...pieceCells(g.state.current).map(([x]) => x)), BOARD_WIDTH - 1);
});

test('rotation cycles through four states and kicks off the wall', () => {
  const g = createGame({ nextPiece: sequence('T') });
  for (let r = 1; r <= 4; r += 1) {
    assert.equal(g.rotate(), true);
    assert.equal(g.state.current.rotation, r % 4);
  }
  // I piece vertical against the right wall should kick back in when rotated.
  const i = createGame({ nextPiece: sequence('I') });
  i.rotate();
  while (i.moveRight());
  assert.equal(i.rotate(), true);
  for (const [x] of pieceCells(i.state.current)) assert.ok(x >= 0 && x < BOARD_WIDTH);
});

test('gravity drops the piece one row per interval and speeds up with level', () => {
  const g = createGame({ nextPiece: sequence('T') });
  const y0 = g.state.current.y;
  g.tick(gravityInterval(1) - 1);
  assert.equal(g.state.current.y, y0);
  g.tick(1);
  assert.equal(g.state.current.y, y0 + 1);
  assert.ok(gravityInterval(5) < gravityInterval(1));
  assert.ok(gravityInterval(100) >= 100);
});

test('hard drop locks the piece at the bottom and spawns the next one', () => {
  const g = createGame({ nextPiece: sequence('O', 'T') });
  assert.equal(g.state.current.type, 'O');
  assert.equal(g.state.next, 'T');
  const rows = g.hardDrop();
  assert.equal(rows, BOARD_HEIGHT - 2);
  assert.equal(g.state.score, rows * 2);
  assert.equal(g.state.board[BOARD_HEIGHT - 1].filter(Boolean).length, 2);
  assert.equal(g.state.current.type, 'T');
});

test('soft drop scores a point per row and locks when blocked', () => {
  const g = createGame({ nextPiece: sequence('O', 'I') });
  assert.equal(g.softDrop(), true);
  assert.equal(g.state.score, 1);
  while (g.softDrop());
  assert.equal(g.state.current.type, 'I');
  assert.equal(g.state.board[BOARD_HEIGHT - 1].filter(Boolean).length, 2);
});

test('completed lines are cleared and scored by count and level', () => {
  const g = createGame({ nextPiece: sequence('I') });
  // Fill the bottom two rows except the four rightmost-but-one columns
  // so a horizontal I completes the bottom row only.
  const b = g.state.board;
  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    if (x < 3 || x > 6) b[BOARD_HEIGHT - 1][x] = 'Z';
  }
  b[BOARD_HEIGHT - 2][0] = 'Z';
  g.hardDrop();
  assert.equal(g.state.lines, 1);
  assert.equal(g.state.board[BOARD_HEIGHT - 1][0], 'Z');
  assert.equal(g.state.board[BOARD_HEIGHT - 1].filter(Boolean).length, 1);
  const dropScore = (BOARD_HEIGHT - 2) * 2;
  assert.equal(g.state.score, dropScore + 100);
});

test('clearing four lines scores a tetris and levels up every ten lines', () => {
  const g = createGame({ nextPiece: sequence('I') });
  g.state.lines = 9;
  g.state.level = 1;
  const b = g.state.board;
  for (let y = BOARD_HEIGHT - 4; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH - 1; x += 1) b[y][x] = 'Z';
  }
  g.rotate();
  while (g.moveRight());
  g.hardDrop();
  assert.equal(g.state.lines, 13);
  assert.equal(g.state.level, 2);
  assert.ok(g.state.score >= 800);
  assert.ok(g.state.board.every((row) => row.every((c) => c === null)));
});

test('game over when a new piece cannot spawn, and restart resets', () => {
  const g = createGame({ nextPiece: sequence('O') });
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (y > 1 && x !== 0) g.state.board[y][x] = 'Z';
    }
  }
  g.hardDrop();
  assert.equal(g.state.gameOver, true);
  assert.equal(g.moveLeft(), false);
  g.tick(10_000);
  g.restart();
  assert.equal(g.state.gameOver, false);
  assert.equal(g.state.score, 0);
  assert.equal(g.state.lines, 0);
  assert.ok(g.state.board.every((row) => row.every((c) => c === null)));
});

test('app routes actions to the game, ignores moves while paused, and shows game over', () => {
  const app = createApp({ nextPiece: sequence('T') });
  const x0 = app.state.game.state.current.x;
  app.handleAction('left');
  assert.equal(app.state.game.state.current.x, x0 - 1);
  app.handleAction('pause');
  app.handleAction('right');
  assert.equal(app.state.game.state.current.x, x0 - 1);
  app.update(5000);
  assert.equal(app.state.game.state.current.y, 0);
  app.handleAction('pause');
  for (let i = 0; i < 50 && !app.state.game.state.gameOver; i += 1) app.handleAction('hardDrop');
  assert.equal(app.state.game.state.gameOver, true);
  const view = app.view();
  assert.ok(view.length <= 24);
  assert.ok(view.some((l) => l.includes('GAME OVER')));
  app.handleAction('restart');
  assert.equal(app.state.game.state.gameOver, false);
  assert.ok(!app.view().some((l) => l.includes('GAME OVER')));
});

test('app view draws the active piece, next preview, and score within 24 rows and 80 columns', () => {
  const app = createApp({ nextPiece: sequence('O', 'I') });
  const view = app.view();
  assert.ok(view.length <= 24);
  for (const line of view) assert.ok(line.length <= 80, line);
  assert.ok(view[1].includes('[][]'));
  assert.ok(view.some((l) => l.includes('SCORE')));
  assert.ok(view.some((l) => l.includes('NEXT')));
  assert.ok(view.some((l) => l.includes('[][][][]')));
});
