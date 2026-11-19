'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { WIDTH, HEIGHT, createBoard, renderBoard } = require('../index');

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
