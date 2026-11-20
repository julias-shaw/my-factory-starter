import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, HEIGHT, WIDTH } from '../src/game.js';
import { MAX_COLS, MAX_ROWS, renderLines, stripAnsi, visibleWidth } from '../src/render.js';
import { createTerminal } from '../src/terminal.js';

function sequence(...types) {
  let i = 0;
  return () => types[i++ % types.length];
}

function plain(game) {
  return renderLines(game, { color: false });
}

function assertFits(lines) {
  assert.ok(lines.length <= MAX_ROWS, `rendered ${lines.length} rows`);
  for (const line of lines) {
    assert.ok(visibleWidth(line) <= MAX_COLS, `line too wide: ${stripAnsi(line)}`);
    assert.ok(!line.includes('\n'), 'lines must not contain newlines');
  }
}

function gameOverGame() {
  const game = createGame({ nextPiece: sequence('O') });
  while (!game.gameOver) game.hardDrop();
  return game;
}

test('playing screen fits in 24 rows with and without colour', () => {
  const game = createGame({ nextPiece: sequence('I', 'T') });
  assertFits(plain(game));
  assertFits(renderLines(game, { color: true }));
});

test('paused and game-over screens fit in 24 rows', () => {
  const paused = createGame({ nextPiece: sequence('L') });
  paused.togglePause();
  assertFits(plain(paused));
  assertFits(renderLines(paused));

  const over = gameOverGame();
  assertFits(plain(over));
  assertFits(renderLines(over));
});

test('large scores still fit within the width limit', () => {
  const game = createGame();
  game.score = 999_999_999;
  game.lines = 99_999;
  game.level = 9_999;
  assertFits(plain(game));
});

test('board has a full border around a 10x20 playfield', () => {
  const lines = plain(createGame());
  assert.equal(lines.length, HEIGHT + 2);
  assert.ok(lines[0].startsWith(`┌${'─'.repeat(WIDTH * 2)}┐`));
  assert.ok(lines[HEIGHT + 1].startsWith(`└${'─'.repeat(WIDTH * 2)}┘`));
  for (let y = 1; y <= HEIGHT; y += 1) {
    assert.equal(lines[y][0], '│');
    assert.equal(lines[y][WIDTH * 2 + 1], '│');
  }
});

test('shows score, lines, level, next piece and controls', () => {
  const game = createGame({ nextPiece: sequence('T', 'I') });
  game.score = 1234;
  game.lines = 7;
  game.level = 2;
  const text = plain(game).join('\n');
  assert.match(text, /Score\s+1234/);
  assert.match(text, /Lines\s+7/);
  assert.match(text, /Level\s+2/);
  assert.match(text, /Next/);
  assert.match(text, /████████/); // the I piece preview
  for (const word of ['move', 'rotate', 'soft drop', 'hard drop', 'pause', 'restart', 'quit']) {
    assert.ok(text.includes(word), `controls mention ${word}`);
  }
});

test('draws the falling piece, its ghost and locked cells inside the board', () => {
  const game = createGame({ nextPiece: sequence('O') });
  game.board[HEIGHT - 1][0] = 'Z';
  const lines = plain(game);
  const inner = (y) => lines[y + 1].slice(1, WIDTH * 2 + 1);
  // O piece spawns at columns 4-5, rows 0-1.
  assert.equal(inner(0).slice(8, 12), '████');
  assert.equal(inner(1).slice(8, 12), '████');
  // Ghost lands on the floor.
  assert.equal(inner(HEIGHT - 1).slice(8, 12), '░░░░');
  // Locked cell.
  assert.equal(inner(HEIGHT - 1).slice(0, 2), '██');
});

test('game over shows a message with restart and quit hints', () => {
  const text = plain(gameOverGame()).join('\n');
  assert.match(text, /GAME OVER/);
  assert.match(text, /r: restart/);
  assert.match(text, /q: quit/);
});

test('pause shows a paused message', () => {
  const game = createGame();
  game.togglePause();
  assert.match(plain(game).join('\n'), /PAUSED/);
});

test('colour output differs from plain output only by escape codes', () => {
  const game = createGame({ nextPiece: sequence('S', 'Z') });
  const coloured = renderLines(game, { color: true });
  assert.notDeepEqual(coloured, plain(game));
  assert.deepEqual(coloured.map(stripAnsi), plain(game));
});

test('terminal draw writes no trailing newline so 24 rows never scroll', () => {
  let written = '';
  const output = { write: (s) => { written += s; } };
  const terminal = createTerminal({ input: {}, output });
  terminal.draw(['a', 'b', 'c']);
  assert.equal((written.match(/\n/g) ?? []).length, 2);
  assert.ok(!written.endsWith('\n'));
});
