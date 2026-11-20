import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeyParser, parseKeys } from '../src/input.js';

test('arrow keys map to movement actions', () => {
  assert.deepEqual(parseKeys('\u001b[D\u001b[C\u001b[B\u001b[A'), ['left', 'right', 'down', 'rotate']);
});

test('letters, space, and control keys map to actions', () => {
  assert.deepEqual(parseKeys('aDsW pr'), ['left', 'right', 'down', 'rotate', 'drop', 'pause', 'restart']);
  assert.deepEqual(parseKeys('q'), ['quit']);
  assert.deepEqual(parseKeys('\u0003'), ['quit']);
});

test('unknown keys are ignored', () => {
  assert.deepEqual(parseKeys('xyz\u001b[Z'), []);
});

test('arrow sequences split across data chunks are reassembled', () => {
  const sequences = {
    '\u001b[D': 'left',
    '\u001b[C': 'right',
    '\u001b[B': 'down',
    '\u001b[A': 'rotate',
    '\u001bOD': 'left',
    '\u001bOC': 'right',
    '\u001bOB': 'down',
    '\u001bOA': 'rotate',
  };
  for (const [seq, action] of Object.entries(sequences)) {
    for (let cut = 1; cut < seq.length; cut += 1) {
      const feed = createKeyParser();
      assert.deepEqual(feed(seq.slice(0, cut)), [], `prefix of ${JSON.stringify(seq)} at ${cut}`);
      assert.deepEqual(feed(seq.slice(cut)), [action], `${JSON.stringify(seq)} split at ${cut}`);
    }
    const feed = createKeyParser();
    assert.deepEqual([...seq].flatMap((ch) => feed(ch)), [action], `${JSON.stringify(seq)} one byte at a time`);
  }
});

test('split sequence followed by more keys in the same chunk', () => {
  const feed = createKeyParser();
  assert.deepEqual(feed('a\u001b'), ['left']);
  assert.deepEqual(feed('[Dq'), ['left', 'quit']);
});

test('lone escape followed by a letter does not swallow the letter', () => {
  const feed = createKeyParser();
  assert.deepEqual(feed('\u001b'), []);
  assert.deepEqual(feed('q'), ['quit']);
});

test('modified and unknown escape sequences never trigger letter actions', () => {
  const sequences = [
    '\u001b[1;5D', // Ctrl-Left
    '\u001b[1;2C', // Shift-Right
    '\u001b[1;3A', // Alt-Up
    '\u001b[1;5B', // Ctrl-Down
    '\u001b[3~', // Delete
    '\u001b[15~', // F5
    '\u001b[<0;10;20M', // mouse report
    '\u001b[?1;2c', // device attributes reply
    '\u001bO5D', // SS3 with modifier
    '\u001bOP', // F1
  ];
  for (const seq of sequences) {
    assert.deepEqual(parseKeys(seq), [], `${JSON.stringify(seq)} in one chunk`);
    for (let cut = 1; cut < seq.length; cut += 1) {
      const feed = createKeyParser();
      const actions = [...feed(seq.slice(0, cut)), ...feed(seq.slice(cut))];
      assert.deepEqual(actions, [], `${JSON.stringify(seq)} split at ${cut}`);
    }
    const feed = createKeyParser();
    assert.deepEqual([...seq].flatMap((ch) => feed(ch)), [], `${JSON.stringify(seq)} one byte at a time`);
  }
});

test('keys after a modified sequence are still parsed', () => {
  assert.deepEqual(parseKeys('\u001b[1;5Dq\u001b[Ds'), ['quit', 'left', 'down']);
  const feed = createKeyParser();
  assert.deepEqual(feed('\u001b[1;'), []);
  assert.deepEqual(feed('5Dw'), ['rotate']);
});
