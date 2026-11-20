import { createTerminal } from './terminal.js';
import { createKeyParser } from './input.js';
import { createGame, gravityInterval } from './game.js';
import { renderLines } from './render.js';

const terminal = createTerminal();
let exiting = false;
const parseKeys = createKeyParser();
const game = createGame();
let gravityTimer = null;

const ACTIONS = {
  left: () => game.moveLeft(),
  right: () => game.moveRight(),
  down: () => game.softDrop(),
  rotate: () => game.rotate(),
  drop: () => game.hardDrop(),
  pause: () => game.togglePause(),
  restart: () => game.restart(),
};

function render() {
  terminal.draw(renderLines(game, { color: process.stdout.hasColors?.() ?? true }));
}

// Re-arm gravity after each step so the interval follows the current level.
function scheduleGravity() {
  clearTimeout(gravityTimer);
  gravityTimer = setTimeout(() => {
    game.tick();
    render();
    scheduleGravity();
  }, gravityInterval(game.level));
}

function exit(code = 0) {
  if (exiting) return;
  exiting = true;
  clearTimeout(gravityTimer);
  terminal.stop();
  process.exit(code);
}

function handleInput(data) {
  for (const action of parseKeys(data)) {
    if (action === 'quit') return exit(0);
    ACTIONS[action]?.();
  }
  render();
}

process.on('SIGINT', () => exit(0));
process.on('SIGTERM', () => exit(0));
process.on('uncaughtException', (err) => {
  terminal.stop();
  console.error(err);
  process.exit(1);
});

terminal.start(handleInput);
process.stdout.on('resize', () => {
  terminal.clear();
  render();
});
render();
scheduleGravity();
