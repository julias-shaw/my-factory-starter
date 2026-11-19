'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { WIDTH, HEIGHT, createBoard, renderBoard, clearFullLines, awardPoints } = require('../index');

test('createBoard returns an independent empty board', () => {
  const board = createBoard();
  assert.equal(board.length, HEIGHT);
  assert.ok(board.every(row => row.length === WIDTH && row.every(cell => cell === 0)));
  board[0][0] = 1;
  assert.equal(board[1][0], 0);
});

test('renderBoard draws a bordered board', () => {
  const board = createBoard();
  const rows = renderBoard(board);
  assert.equal(rows.length, HEIGHT + 2);
  assert.equal(rows[0], '+' + '-'.repeat(WIDTH * 2) + '+');
  assert.equal(rows[rows.length - 1], '+' + '-'.repeat(WIDTH * 2) + '+');
  for (let y = 1; y <= HEIGHT; y++) {
    assert.equal(rows[y][0], '|');
    assert.equal(rows[y][rows[y].length - 1], '|');
  }
});

test('renderBoard shows filled and empty cells', () => {
  const board = createBoard();
  board[0][0] = 1;
  board[HEIGHT - 1][WIDTH - 1] = 1;
  const rows = renderBoard(board);
  assert.match(rows[1], /^\|\[\]/);
  assert.match(rows[HEIGHT], /.*\[\]\|$/);
});

test('clearFullLines removes full rows and shifts rows down', () => {
  const board = createBoard();
  for (let x = 0; x < WIDTH; x++) board[HEIGHT - 1][x] = 1;
  board[HEIGHT - 2][0] = 1;
  const cleared = clearFullLines(board);
  assert.equal(cleared, 1);
  assert.equal(board[HEIGHT - 1][0], 1);
  assert.ok(board[0].every(cell => cell === 0));
});

test('clearFullLines returns multiple cleared lines', () => {
  const board = createBoard();
  for (let x = 0; x < WIDTH; x++) {
    board[HEIGHT - 1][x] = 1;
    board[HEIGHT - 2][x] = 1;
  }
  const cleared = clearFullLines(board);
  assert.equal(cleared, 2);
  assert.ok(board.slice(HEIGHT - 2).every(row => row.every(cell => cell === 0)));
});

test('awardPoints updates score, lines, and level', () => {
  const state = { score: 0, lines: 0, level: 1 };
  awardPoints(state, 1);
  assert.equal(state.score, 40);
  assert.equal(state.lines, 1);
  assert.equal(state.level, 1);

  state.level = 2;
  awardPoints(state, 4);
  assert.equal(state.score, 40 + 2400);
  assert.equal(state.lines, 5);
  assert.equal(state.level, 1);

  state.score = 0;
  state.lines = 9;
  state.level = 1;
  awardPoints(state, 1);
  assert.equal(state.lines, 10);
  assert.equal(state.level, 2);
});
