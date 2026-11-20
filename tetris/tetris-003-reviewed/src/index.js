#!/usr/bin/env node

import { emitKeypressEvents } from 'node:readline';
import { TetrisGame } from './game.js';
import { renderGame } from './renderer.js';

const game = new TetrisGame();
const useColor = Boolean(process.stdout.isTTY);

function render() {
  const screen = renderGame(game, { color: useColor });
  if (process.stdout.isTTY) {
    process.stdout.write(`\x1b[2J\x1b[H${screen}`);
  } else {
    process.stdout.write(`${screen}\n`);
  }
}

// Piped output is useful for smoke tests and does not have an interactive
// keyboard, so print one complete screen rather than waiting forever.
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  render();
} else {
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let gravityTimer;
  let stopped = false;

  function scheduleGravity() {
    clearTimeout(gravityTimer);
    gravityTimer = setTimeout(() => {
      if (stopped) return;
      game.tick();
      render();
      scheduleGravity();
    }, game.gravityInterval);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(gravityTimer);
    process.stdin.removeListener('keypress', onKeypress);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\x1b[0m\x1b[?25h\n');
  }

  function onKeypress(key, data) {
    if (stopped) return;
    if ((data.ctrl && data.name === 'c') || data.name === 'q') {
      game.quit();
      stop();
      return;
    }

    const actions = {
      left: 'left',
      a: 'left',
      right: 'right',
      d: 'right',
      down: 'down',
      s: 'down',
      up: 'rotate',
      w: 'rotate',
      x: 'rotate',
      z: 'rotate-ccw',
      space: 'drop',
    };

    if (data.name === 'r') {
      game.restart();
      scheduleGravity();
    } else if (actions[data.name]) {
      game.action(actions[data.name]);
    } else {
      return;
    }
    render();
  }

  process.stdin.on('keypress', onKeypress);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  process.stdout.write('\x1b[?25l');
  render();
  scheduleGravity();
}
