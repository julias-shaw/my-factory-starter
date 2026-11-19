#!/usr/bin/env node

const WIDTH = 10;
const HEIGHT = 20;

function createBoard() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
}

function renderBoard(board) {
  const horizontal = '-'.repeat(WIDTH * 2);
  const rows = [];
  rows.push('+' + horizontal + '+');
  for (let y = 0; y < HEIGHT; y++) {
    let line = '|';
    for (let x = 0; x < WIDTH; x++) {
      line += board[y][x] ? '[]' : '  ';
    }
    line += '|';
    rows.push(line);
  }
  rows.push('+' + horizontal + '+');
  return rows;
}

function render(state) {
  const score = String(state.score).padStart(5, ' ');
  const lines = String(state.lines).padStart(5, ' ');
  const level = String(state.level).padStart(2, ' ');

  const header = ` TETRIS        Score:${score}  Lines:${lines}  Level:${level}`;
  const footer = state.gameOver
    ? ' >>> GAME OVER <<<          Press Q to quit'
    : ' Controls: Left/Down/Right move   Space: rotate   Q: quit';

  const panel = [
    '',
    ' Next piece:',
    '      ',
    '',
    ' Score',
    ` ${score}`,
    '',
    ' Lines',
    ` ${lines}`,
    '',
    ' Level',
    ` ${level}`,
    '',
    ' Controls',
    ' Left  ',
    ' Down  ',
    ' Right ',
    ' Space ',
    ' Q     ',
    '',
  ];

  const boardRows = renderBoard(state.board);
  const rows = [];
  rows.push(header.slice(0, 80));

  for (let y = 0; y < boardRows.length; y++) {
    const p = panel[y] ?? '';
    rows.push((boardRows[y] + '  ' + p).slice(0, 80));
  }

  rows.push(footer.slice(0, 80));

  while (rows.length < 24) {
    rows.push('');
  }

  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(rows.slice(0, 24).join('\n') + '\n');
}

const state = {
  board: createBoard(),
  score: 0,
  lines: 0,
  level: 1,
  gameOver: false,
};

if (require.main === module) {
  render(state);
}

module.exports = { WIDTH, HEIGHT, createBoard, renderBoard, render };
