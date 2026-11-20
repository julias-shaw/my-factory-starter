#!/usr/bin/env node
// Entry point for `npm start`: wires input, game loop, and rendering together.

import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createApp, fitToTerminal } from './app.js';
import { startInput } from './input.js';
import { createLoop } from './loop.js';
import { createRenderer } from './renderer.js';

export function run({ stdin = process.stdin, stdout = process.stdout } = {}) {
  const renderer = createRenderer(stdout);
  let stopInput = () => {};
  let loop = null;
  let finished = false;

  function shutdown(code = 0) {
    if (finished) return;
    finished = true;
    loop?.stop();
    stopInput();
    renderer.stop();
    stdout.off?.('resize', onResize);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    process.off('uncaughtException', onException);
    process.exitCode = code;
  }

  function onSignal() {
    shutdown(0);
  }

  function onException(err) {
    shutdown(1);
    console.error(err);
  }

  function onResize() {
    renderer.invalidate();
    draw();
  }

  // Draws the game, or a resize notice (pausing play) if the terminal is
  // too small to show the whole display.
  function draw() {
    const lines = app.view();
    const fitted = fitToTerminal(lines, stdout.columns, stdout.rows);
    if (fitted !== lines) app.pause();
    renderer.draw(fitted);
  }

  const app = createApp({ onQuit: () => shutdown(0) });
  loop = createLoop({
    update: (dt) => app.update(dt),
    render: draw,
  });

  renderer.start();
  stopInput = startInput(stdin, (action) => {
    app.handleAction(action);
    if (!finished) draw();
  });
  stdout.on?.('resize', onResize);
  loop.start();

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  process.once('uncaughtException', onException);

  return { app, shutdown };
}

// Only auto-start when executed directly (`npm start`, `node src/index.js`,
// or the npm bin symlink), never when imported as a module.
export function isMainModule(argv1 = process.argv[1], moduleUrl = import.meta.url) {
  if (!argv1) return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(moduleUrl))).href;
  } catch {
    return false;
  }
}

if (isMainModule()) run();
