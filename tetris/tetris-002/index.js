#!/usr/bin/env node

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const ANSI = {
  clear: '\x1b[2J',
  home: '\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  white: '\x1b[37m'
};

function moveTo(row, col) {
  return `\x1b[${row};${col}H`;
}

function clearScreen() {
  process.stdout.write(ANSI.clear + ANSI.home);
}

function drawBox(topRow, leftCol, width, height) {
  const horizontal = '─'.repeat(width - 2);
  process.stdout.write(moveTo(topRow, leftCol) + '┌' + horizontal + '┐');
  for (let row = 1; row < height - 1; row++) {
    process.stdout.write(moveTo(topRow + row, leftCol) + '│');
    process.stdout.write(moveTo(topRow + row, leftCol + width - 1) + '│');
  }
  process.stdout.write(moveTo(topRow + height - 1, leftCol) + '└' + horizontal + '┘');
}

function fillRect(topRow, leftCol, width, height, char) {
  const line = char.repeat(width);
  for (let row = 0; row < height; row++) {
    process.stdout.write(moveTo(topRow + row, leftCol) + line);
  }
}

function renderBoard() {
  const boardLeft = 1;
  const boardTop = 1;
  const boxWidth = BOARD_WIDTH + 2;
  const boxHeight = BOARD_HEIGHT + 2;

  drawBox(boardTop, boardLeft, boxWidth, boxHeight);
  fillRect(boardTop + 1, boardLeft + 1, BOARD_WIDTH, BOARD_HEIGHT, ' ');
}

function renderPanel() {
  const panelLeft = BOARD_WIDTH + 5;

  process.stdout.write(moveTo(1, panelLeft) + ANSI.bold + ANSI.cyan + 'TETRIS' + ANSI.reset);
  process.stdout.write(moveTo(3, panelLeft) + ANSI.bold + 'Score' + ANSI.reset);
  process.stdout.write(moveTo(4, panelLeft) + '0');
  process.stdout.write(moveTo(6, panelLeft) + ANSI.bold + 'Level' + ANSI.reset);
  process.stdout.write(moveTo(7, panelLeft) + '1');
  process.stdout.write(moveTo(9, panelLeft) + ANSI.bold + 'Lines' + ANSI.reset);
  process.stdout.write(moveTo(10, panelLeft) + '0');

  process.stdout.write(moveTo(13, panelLeft) + ANSI.bold + 'Controls' + ANSI.reset);
  process.stdout.write(moveTo(14, panelLeft) + '← →  move');
  process.stdout.write(moveTo(15, panelLeft) + '↑    rotate');
  process.stdout.write(moveTo(16, panelLeft) + '↓    soft drop');
  process.stdout.write(moveTo(17, panelLeft) + 'spc  hard drop');
  process.stdout.write(moveTo(18, panelLeft) + 'p    pause');
  process.stdout.write(moveTo(19, panelLeft) + 'q    quit');
}

function renderFooter() {
  const footerRow = BOARD_HEIGHT + 3;
  process.stdout.write(
    moveTo(footerRow, 1) +
    ANSI.yellow +
    'Layout preview — gameplay coming next.' +
    ANSI.reset
  );
}

function render() {
  clearScreen();
  renderBoard();
  renderPanel();
  renderFooter();
}

process.stdout.write(ANSI.hideCursor);
render();

setInterval(() => {
  render();
}, 1000);

function cleanup() {
  process.stdout.write(ANSI.showCursor);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
