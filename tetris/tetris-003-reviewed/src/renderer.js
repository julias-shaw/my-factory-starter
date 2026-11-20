import { BOARD_HEIGHT } from './game.js';

export const DISPLAY_ROWS = 24;

const BACKGROUND_COLORS = Object.freeze({
  I: '\x1b[46m',
  J: '\x1b[44m',
  L: '\x1b[43m',
  O: '\x1b[43m',
  S: '\x1b[42m',
  T: '\x1b[45m',
  Z: '\x1b[41m',
});
const RESET = '\x1b[0m';

/** Render the game as exactly 24 rows for the standard 20-row board. */
export function renderLines(game, { color = true } = {}) {
  const horizontalBorder = `+${'-'.repeat(game.width * 2)}+`;
  const lines = [horizontalBorder];

  for (const row of game.getBoard()) {
    const cells = row.map((type) => {
      if (!type) return '  ';
      if (!color) return '[]';
      return `${BACKGROUND_COLORS[type]}  ${RESET}`;
    });
    lines.push(`|${cells.join('')}|`);
  }

  lines.push(horizontalBorder);
  lines.push(
    `Score: ${game.score}  Lines: ${game.lines}  Level: ${game.level}  Next: ${game.nextType ?? '-'}`,
  );

  if (game.gameOver) {
    lines.push('GAME OVER!  R restart  Q quit');
  } else if (game.status === 'quit') {
    lines.push('Game quit.  R restart  Q exit');
  } else {
    lines.push('Arrows/WASD move  Up/X rotate  Z ccw  Space drop  R restart  Q quit');
  }

  if (game.height === BOARD_HEIGHT && lines.length !== DISPLAY_ROWS) {
    throw new Error(`Renderer produced ${lines.length} rows instead of ${DISPLAY_ROWS}`);
  }
  return lines;
}

export function renderGame(game, options) {
  return renderLines(game, options).join('\n');
}
