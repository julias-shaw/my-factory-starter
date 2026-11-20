'use strict';

const { renderGame } = require('./board');
const { TetrisGame } = require('./game');

const game = new TetrisGame();

function render() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[H\x1b[2J');
  }
  process.stdout.write(`${renderGame(game)}\n`);
}

render();
game.start(render);
