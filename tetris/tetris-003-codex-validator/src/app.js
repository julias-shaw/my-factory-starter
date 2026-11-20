// Application shell: owns app state, handles actions, and builds the view.
// Gameplay rules plug in here in a later step.

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export function createApp({ onQuit = () => {} } = {}) {
  const state = {
    paused: false,
    elapsedMs: 0,
    lastAction: null,
  };

  function handleAction(action) {
    state.lastAction = action;
    if (action === 'quit') {
      onQuit();
    } else if (action === 'pause') {
      state.paused = !state.paused;
    }
  }

  function update(dtMs) {
    if (!state.paused) state.elapsedMs += dtMs;
  }

  function view() {
    const lines = [];
    lines.push('+' + '--'.repeat(BOARD_WIDTH) + '+');
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      lines.push('|' + ' .'.repeat(BOARD_WIDTH) + '|');
    }
    lines.push('+' + '--'.repeat(BOARD_WIDTH) + '+');
    const status = state.paused ? 'PAUSED' : `Time ${Math.floor(state.elapsedMs / 1000)}s`;
    lines.push(`${status}  Last key: ${state.lastAction ?? '-'}`);
    lines.push('Arrows/WASD move  Space drop  P pause  Q quit');
    return lines;
  }

  return { state, handleAction, update, view };
}
