import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { parseKeys, startInput } from '../src/input.js';
import { createLoop } from '../src/loop.js';
import { composeFrame, createRenderer } from '../src/renderer.js';
import { createApp, fitToTerminal } from '../src/app.js';

test('fitToTerminal passes the view through when it fits and replaces it when too small', () => {
  const app = createApp({ random: () => 0 });
  const lines = app.view();
  const width = Math.max(...lines.map((l) => l.length));
  assert.equal(fitToTerminal(lines, 80, 24), lines);
  assert.equal(fitToTerminal(lines, width, 24), lines);
  assert.equal(fitToTerminal(lines, undefined, undefined), lines);

  for (const [cols, rows] of [[width - 1, 24], [80, 23], [20, 3]]) {
    const small = fitToTerminal(lines, cols, rows);
    assert.notEqual(small, lines);
    assert.equal(small[0], 'Terminal too small'.slice(0, cols));
    assert.ok(small.length <= rows);
    for (const line of small) assert.ok(line.length <= cols);
  }

  app.pause();
  assert.equal(app.state.paused, true);
  app.handleAction('pause');
  assert.equal(app.state.paused, false);
});

test('parseKeys maps arrows, letters, and multi-key chunks', () => {
  assert.deepEqual(parseKeys('\u001b[D\u001b[C\u001b[A\u001b[B'), ['left', 'right', 'rotate', 'softDrop']);
  assert.deepEqual(parseKeys('aWd s'), ['left', 'rotate', 'right', 'hardDrop', 'softDrop']);
  assert.deepEqual(parseKeys('pqR\u0003'), ['pause', 'quit', 'restart', 'quit']);
  assert.deepEqual(parseKeys('xyz\u001b[Z'), []);
});

test('startInput dispatches actions and restores the stream', () => {
  const stdin = new EventEmitter();
  stdin.isTTY = true;
  stdin.isRaw = false;
  stdin.setRawMode = (v) => { stdin.isRaw = v; };
  stdin.setEncoding = () => {};
  stdin.resume = () => {};
  stdin.pause = () => {};
  const seen = [];
  const stop = startInput(stdin, (a) => seen.push(a));
  assert.equal(stdin.isRaw, true);
  stdin.emit('data', 'a\u001b[C');
  assert.deepEqual(seen, ['left', 'right']);
  stdin.emit('data', '\u001b[');
  stdin.emit('data', 'D');
  assert.deepEqual(seen, ['left', 'right', 'left']);
  stdin.emit('data', 's\u001b');
  stdin.emit('data', '[A');
  assert.deepEqual(seen, ['left', 'right', 'left', 'softDrop', 'rotate']);
  stop();
  assert.equal(stdin.isRaw, false);
  stdin.emit('data', 'a');
  assert.equal(seen.length, 5);
});

test('loop passes elapsed time to update and renders each tick', () => {
  let t = 1000;
  const dts = [];
  let renders = 0;
  const loop = createLoop({ update: (dt) => dts.push(dt), render: () => { renders += 1; }, now: () => t });
  loop.start();
  assert.equal(renders, 1);
  t += 50;
  loop.tick();
  t += 20;
  loop.tick();
  loop.stop();
  assert.deepEqual(dts, [50, 20]);
  assert.equal(renders, 3);
  assert.equal(loop.running, false);
});

test('renderer homes the cursor, clears lines, and skips identical frames', () => {
  const frame = composeFrame(['ab', 'cd']);
  assert.ok(frame.startsWith('\u001b[H'));
  assert.ok(frame.includes('ab\u001b[0m\u001b[K\r\ncd'));
  const out = [];
  const r = createRenderer({ write: (s) => out.push(s) });
  r.start();
  r.draw(['x']);
  r.draw(['x']);
  r.draw(['y']);
  r.stop();
  assert.equal(out.length, 4);
  assert.ok(out[3].includes('\u001b[?25h'));
});

test('app view fits within 24 rows and handles pause/quit', () => {
  let quit = false;
  const app = createApp({ onQuit: () => { quit = true; } });
  assert.ok(app.view().length <= 24);
  app.handleAction('pause');
  app.update(500);
  assert.equal(app.state.elapsedMs, 0);
  assert.ok(app.view().some((l) => l.includes('PAUSED')));
  app.handleAction('pause');
  app.update(500);
  assert.equal(app.state.elapsedMs, 500);
  app.handleAction('quit');
  assert.equal(quit, true);
});

test('importing src/index.js has no terminal or process side effects', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = `
    const before = { sigint: process.listenerCount('SIGINT'), sigterm: process.listenerCount('SIGTERM'), exc: process.listenerCount('uncaughtException') };
    const mod = await import('./src/index.js');
    const after = { sigint: process.listenerCount('SIGINT'), sigterm: process.listenerCount('SIGTERM'), exc: process.listenerCount('uncaughtException') };
    console.log(JSON.stringify({ same: JSON.stringify(before) === JSON.stringify(after), run: typeof mod.run }));
  `;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    input: '',
    timeout: 5000,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.signal, null);
  assert.deepEqual(JSON.parse(res.stdout.trim()), { same: true, run: 'function' });
});

test('isMainModule only matches when the entry file is executed directly', async () => {
  const { isMainModule } = await import('../src/index.js');
  const entry = new URL('../src/index.js', import.meta.url);
  const { fileURLToPath } = await import('node:url');
  assert.equal(isMainModule(fileURLToPath(entry), entry.href), true);
  assert.equal(isMainModule(fileURLToPath(new URL('../src/app.js', import.meta.url)), entry.href), false);
  assert.equal(isMainModule(undefined, entry.href), false);
});

test('run() shutdown removes its SIGINT, SIGTERM, and uncaughtException listeners', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = `
    import { EventEmitter } from 'node:events';
    const counts = () => ['SIGINT', 'SIGTERM', 'uncaughtException'].map((e) => process.listenerCount(e));
    const { run } = await import('./src/index.js');
    const stdin = Object.assign(new EventEmitter(), { isTTY: false, setEncoding() {}, resume() {}, pause() {} });
    const stdout = Object.assign(new EventEmitter(), { columns: 80, rows: 24, write() { return true; } });
    const before = counts();
    const { shutdown } = run({ stdin, stdout });
    const during = counts();
    shutdown(0);
    const after = counts();
    console.log(JSON.stringify({ before, during, after }));
  `;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    input: '',
    timeout: 5000,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  const { before, during, after } = JSON.parse(res.stdout.trim().split('\n').pop());
  assert.deepEqual(before, [0, 0, 0]);
  assert.deepEqual(during, [1, 1, 1]);
  assert.deepEqual(after, [0, 0, 0]);
});

test('full display stays within 24 rows and 80 columns in every state', async () => {
  const { createApp, VIEW_ROWS, VIEW_COLS, CONTROLS } = await import('../src/app.js');
  const app = createApp();
  const check = (label) => {
    const view = app.view();
    assert.equal(view.length, VIEW_ROWS, label);
    for (const line of view) assert.ok(line.length <= VIEW_COLS, `${label}: ${line}`);
    assert.equal(view[0], view[21], `${label}: top and bottom borders drawn`);
    assert.ok(view.includes(CONTROLS), `${label}: controls shown`);
    const frame = composeFrame(view);
    assert.ok(frame.split('\r\n').length <= 24, `${label}: frame rows`);
    assert.ok(!frame.endsWith('\n'), `${label}: no trailing newline`);
    return view;
  };
  check('playing');
  assert.ok(check('playing').some((l) => l.includes('SCORE')));
  app.handleAction('pause');
  assert.ok(check('paused').some((l) => l.includes('PAUSED - press P')));
  app.handleAction('pause');
  app.state.game.state.score = 999999999999;
  app.state.game.state.lines = 99999;
  app.state.elapsedMs = 99999999;
  check('large numbers');
  for (let i = 0; i < 50 && !app.state.game.state.gameOver; i += 1) app.handleAction('hardDrop');
  assert.equal(app.state.game.state.gameOver, true);
  assert.ok(check('game over').some((l) => l.includes('GAME OVER - press R')));
});

test('composeFrame never draws more than 24 rows', () => {
  const frame = composeFrame(Array.from({ length: 30 }, (_, i) => `row${i}`));
  assert.equal(frame.split('\r\n').length, 24);
  assert.ok(!frame.includes('row24'));
});
