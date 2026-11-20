// Renders game frames to the terminal using ANSI escape sequences.

export const ESC = '\u001b[';
export const ENTER_ALT_SCREEN = `${ESC}?1049h`;
export const LEAVE_ALT_SCREEN = `${ESC}?1049l`;
export const HIDE_CURSOR = `${ESC}?25l`;
export const SHOW_CURSOR = `${ESC}?25h`;
export const CLEAR_SCREEN = `${ESC}2J`;
export const HOME = `${ESC}H`;
export const CLEAR_LINE = `${ESC}K`;
export const RESET = `${ESC}0m`;

// Turns a list of text lines into one terminal frame: each line is drawn
// from the top-left and cleared to end of line, then leftover rows below
// are cleared so shrinking frames leave no residue.
export function composeFrame(lines) {
  const body = lines.map((line) => `${line}${RESET}${CLEAR_LINE}`).join('\r\n');
  return `${HOME}${body}${ESC}J`;
}

export function createRenderer(stdout) {
  let last = null;
  return {
    start() {
      stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR + CLEAR_SCREEN + HOME);
    },
    draw(lines) {
      const frame = composeFrame(lines);
      if (frame === last) return;
      last = frame;
      stdout.write(frame);
    },
    invalidate() {
      last = null;
      stdout.write(CLEAR_SCREEN);
    },
    stop() {
      stdout.write(RESET + SHOW_CURSOR + LEAVE_ALT_SCREEN);
    },
  };
}
