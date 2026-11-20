#!/usr/bin/env node
// Entry point for terminal Tetris. Launched via `npm start`.

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Game } from './game.js';
import { applyAction, parseKeys } from './input.js';
import { frame, render } from './render.js';

const ESC = '\u001b[';
const ENTER_SCREEN = `${ESC}?1049h${ESC}?25l${ESC}2J`;
const LEAVE_SCREEN = `${ESC}0m${ESC}?25h${ESC}?1049l`;

export function main({ stdin = process.stdin, stdout = process.stdout, game = new Game() } = {}) {
  if (!stdin.isTTY || !stdout.isTTY) {
    stdout.write('Terminal Tetris requires an interactive terminal (TTY).\n');
    process.exitCode = 1;
    return null;
  }

  let timer = null;
  let running = true;

  const draw = () => {
    const lines = render(game, { columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    stdout.write(frame(lines));
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = null;
    if (!running || !game.active) return;
    timer = setTimeout(() => {
      game.tick();
      draw();
      schedule();
    }, game.interval);
  };

  const onResize = () => {
    stdout.write(`${ESC}2J`);
    draw();
  };

  function quit() {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    stdin.removeListener('data', onData);
    stdout.removeListener('resize', onResize);
    process.removeListener('exit', restoreTerminal);
    stdin.setRawMode(false);
    stdin.pause();
    restoreTerminal();
    stdout.write('Thanks for playing Tetris!\n');
  }

  function restoreTerminal() {
    stdout.write(LEAVE_SCREEN);
  }

  function onData(data) {
    const wasActive = game.active;
    const level = game.level;
    for (const action of parseKeys(String(data))) {
      if (applyAction(game, action) === 'quit') {
        quit();
        return;
      }
    }
    draw();
    // Restart the gravity timer when play resumes, restarts or speeds up.
    if (game.active !== wasActive || game.level !== level || !timer) schedule();
  }

  stdout.write(ENTER_SCREEN);
  process.on('exit', restoreTerminal);
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.on('data', onData);
  stdin.resume();
  stdout.on('resize', onResize);

  draw();
  schedule();

  return { game, quit };
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
