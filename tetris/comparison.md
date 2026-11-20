Lean software manufacturing · Homework 002

# Tetris, across three generations.

One seed, a factory that now checks its work, and two choices of validator lens.
This report compares the preserved 001 game with the combined-lens 002 build,
then examines the testability-only bonus.

- 3 preserved generations

- 1 unchanged seed

- 2 validator lens choices

- 39 passing factory examples

## What changed with validation?

The combined lens produced traceable testability changes: exported game-rule
functions, injectable randomness, shape data separated from colors, and a board
renderer that returns rows. Recorded findings also prompted clearer status text
during development. Gameplay additions such as hard drop, restart, and different
scoring are observable differences, but the recorded findings do not establish
that validation caused them.

## 001 → 002

001 used the original unvalidated loop. 002 used one validator with
**testability and usability**. The factory generated all game code; this
comparison did not edit the games.

**Observed code and behavior**

#### Seed and startup

- **tetris-001:** Same saved terminal-Tetris seed; npm start; 10×20 board.

- **tetris-002 · combined lens:** Same saved seed; npm start; 10×20 board.

#### Core game rules

- **tetris-001:** Module-level state; no exported API or import-safe entry
  point.

- **tetris-002 · combined lens:** Exported collision, movement, rotation, drop,
  lock/spawn, line-clear, and scoring helpers; CLI guarded by require.main.

#### Deterministic checks

- **tetris-001:** randomPiece calls Math.random internally.

- **tetris-002 · combined lens:** createPiece and lockAndSpawn accept an RNG
  argument; deterministic piece selection works in an ordinary Node process.

#### Rendering

- **tetris-001:** draw writes the whole display directly to stdout.

- **tetris-002 · combined lens:** renderBoard returns board-row strings; the
  surrounding panel and status renderer still write ANSI output directly.

#### Automated checks included

- **tetris-001:** No test script or included game test suite.

- **tetris-002 · combined lens:** npm test is still the failing npm-init
  placeholder. Six independent rule checks and three display-state checks passed
  during this comparison; they are not an included game suite.

#### On-screen controls

- **tetris-001:** Arrows move/rotate/soft drop; P pauses; Q quits.

- **tetris-002 · combined lens:** Arrows move/rotate/soft drop; Space hard
  drops; P pauses; Q quits; R restarts after game over.

#### Line-clear points

- **tetris-001:** 40 / 100 / 300 / 1200, multiplied by level.

- **tetris-002 · combined lens:** 100 / 300 / 500 / 800, without a level
  multiplier. A generation difference without a matching recorded validator
  request.

#### Gravity and feel

- **tetris-001:** 800 ms initial gravity and a 500 ms lock delay.

- **tetris-002 · combined lens:** 1000 ms gravity; immediate lock when downward
  movement fails. No matching recorded finding establishes a validation effect.

#### Terminal display

- **tetris-001:** Normal capture uses 23 rows; title and controls remain
  visible.

- **tetris-002 · combined lens:** Normal capture uses 23 rows. Independent
  rendering checks also measure row 23 for pause and game over.

#### Exit smoke check

- **tetris-001:** Q exits with code 0 and restores canonical/echo input modes.

- **tetris-002 · combined lens:** Q exits with code 0 and restores
  canonical/echo input modes.

[001 source][source-1] · [002 source][source-2]

## Changes supported by recorded findings

These changes match validator requests recorded under the active task in the
plan. Other gameplay differences are listed separately above.

*Testability · plan 3.1–3.2*

### An API that tests can call

The validator asked for exported functions and an injectable RNG. The final
source exports core rules behind an import-safe entry guard and accepts a
supplied RNG in createPiece. Independent checks generated identical pieces with
the same RNG and exercised collision and locking without a terminal.

[Plan entries 3.1–3.2][source-3] · [createPiece, lockAndSpawn, and
module.exports][source-2]

*Testability · plan 3.3*

### Shapes separated from colors

The shape matrices now live in TETROMINO_SHAPES and ANSI colors in
TETROMINO_COLORS. This matches the recorded request. Separation remains partial:
locked board cells still store color strings, and rendered rows still contain
ANSI codes.

[Plan entry 3.3][source-3] · [Shape/color definitions and lockPiece][source-2]

*Testability · plan 3.6*

### Board rendering returns data

The validator requested an alternative to writing directly to process.stdout.
renderBoard now returns an array of 20 row strings. The independent check
inspected row count and visible width without intercepting stdout.

[Plan entry 3.6][source-3] · [renderBoard][source-2]

*Usability · plan 3.4–3.5, 3.7–3.8*

### Clearer status and controls

Recorded findings asked to remove misleading preview/coming-next wording, stop
advertising unwired actions, and fix an awkward split status label. Those
development-stage messages were revised. The final game shows implemented
controls and context-specific pause/game-over text; its additional gameplay
features were planned separately.

[Recorded status/controls subtasks][source-3] · [renderPanel and
renderStatus][source-2]

Plan entries 3.1–3.8 match validator requests observed during the run. Entries
9.1–9.6 were first added by the doer as verification/cleanup notes, so they are
not counted as validator-origin findings. A later validator rejected
insufficient verification evidence; interrupted calls did not retain a complete
transcript of every finding. The plans are useful traces, not exhaustive
execution logs.

### Original 001 plan

```text
# Tetris-001 Plan

1. [x] Initialize an npm project with `npm start` script and a clear entry file.
2. [x] Render an empty bordered board within 24 terminal rows, with a side panel
   for score and controls.
3. [x] Implement Tetris pieces (shapes, colors optional) and spawn them at the
   top of the board.
4. [x] Implement piece movement: left, right, down, and rotation.
5. [x] Implement collision detection, line clearing, and score tracking.
6. [x] Add gravity/lock delay and game-over detection.
7. [x] Add controls display and final polish/test under `npm start`.
```

### Combined-lens 002 plan and recorded subtasks

```text
# Tetris-002 Plan

Seed: build a terminal Tetris that starts with `npm start`, keeps the whole
display (board, score, controls, borders, game-over messages) within 24
terminal rows, and may use packages for rendering/input.

1. [x] Initialize an npm project with an `npm start` script and a clear entry
   file.
2. [x] Render the full layout — bordered board, score, and controls — inside 24
   rows.
3. [x] Add the seven tetrominoes, random piece generation, and active-piece
   rendering.
   3.1 Export createBoard, createPiece, and renderBoard so tests can drive piece
      logic without the CLI.
   3.2 Make createPiece accept an injectable RNG so random generation tests are
      deterministic.
   3.3 Separate tetromino shape matrices from ANSI color strings.
   3.4 Update footer text to accurately describe the active-piece rendering.
   3.5 Trim controls panel to only advertise actions wired in this task.
   3.6 Make renderBoard return the rendered board as a string array instead of
      writing directly to process.stdout.
   3.7 Fix awkward line split of "Active piece" / "rendered." in the status
      panel.
   3.8 Ensure the controls panel does not advertise move, rotate, drop, pause,
      or quit as coming next.
4. [x] Add left/right movement and rotation with collision checks and wall
   kicks.
5. [x] Add gravity, soft drop, hard drop, and piece locking.
6. [x] Add completed-line clearing and scoring, shown live in the layout.
7. [x] Add game-over detection with a message and restart, plus pause/quit.
8. [x] Restore terminal state (input mode, cursor) on exit or interruption.
9. [x] Verify `npm start` and confirm the display stays within 24 rows.
   9.1 Confirm `npm start` launches the game without errors.
   9.2 Measure rendered rows during normal play; ensure ≤ 24.
   9.3 Measure rendered rows for the game-over screen; ensure ≤ 24.
   9.4 Measure rendered rows for the paused screen; ensure ≤ 24.
   9.5 Fix duplicate terminal cursor/reset output on exit paths.
   9.6 Remove unused `renderFooter` helper left over from earlier layout
      iterations.
```

## Captured in the terminal

Live text snapshots from `npm start` in an 80-column, 24-row pseudo-terminal,
captured after two seconds. Pieces are random; their positions are not a
comparison metric. These are smoke checks, not a full playthrough.

### 001 · unvalidated · 80 × 24 terminal

```text
  TERMINAL TETRIS
╔══════════╗  SCORE       0
║          ║  LINES       0
║          ║  LEVEL       1
║   ████   ║
║          ║  CONTROLS
║          ║  ← →  move
║          ║  ↑    rotate
║          ║  ↓    soft drop
║          ║  p    pause
║          ║  q    quit
║          ║
║          ║
║          ║
║          ║
║          ║
║          ║
║          ║
║          ║
║          ║
║          ║
║          ║
╚══════════╝
```

Live npm start capture · quit exit code 0

### 002 · testability + usability · 80 × 24 terminal

```text
┌──────────┐  TETRIS
│          │
│    ██    │  Score
│    ██    │  0
│          │
│          │  Level
│          │  1
│          │
│          │  Lines
│          │  0
│          │
│          │
│          │  Controls
│          │  ← / → move
│          │  ↑ rotate
│          │  ↓ soft drop
│          │  space hard drop
│          │  P pause
│          │  Q quit
│          │
│          │
└──────────┘
Move ←/→  Rotate ↑  Soft drop ↓  Hard drop space
```

Live npm start capture · quit exit code 0

## Bonus: testability alone

Both 002 builds used the same saved seed and the configured `pi` model,
`openrouter/moonshotai/kimi-k2.7-code`. The bonus target changed the lens to
testability alone. Each target generated its own plan.

The testability-only build includes ten passing Node tests and a pure full-frame
generator, but has no recorded validator-rejection subtasks. Its one nested plan
item fixes the doer's own failing test expectation. The live 24-row terminal
capture reveals a title-clipping issue that the frame-length tests miss. These
are useful observed differences; independently generated plans and model
variation prevent attributing them to the lens alone.

**Combined lens vs. testability alone**

#### Included game tests

- **Combined lens:** No working npm test script; separate comparison checks
  passed.

- **Testability alone:** npm test runs 10 passing node:test cases: board
  rendering, line clearing, scoring, controls, dimensions, and game-over text.

#### Rendering seam

- **Combined lens:** Board rows returned as strings; full layout still writes
  ANSI directly.

- **Testability alone:** generateFrame returns the whole display as a pure
  string; render performs the terminal writes.

#### Piece selection

- **Combined lens:** Injectable RNG for createPiece and lockAndSpawn.

- **Testability alone:** createPiece accepts an explicit shape key for
  deterministic tests; default selection still uses Math.random.

#### Recorded findings

- **Combined lens:** Eight validator-origin subtasks under task 3; additional
  self-added verification notes under task 9.

- **Testability alone:** No validator-rejection findings recorded. One
  self-added subtask corrected a line-clear test expectation.

#### Controls and features

- **Combined lens:** Space hard drop, P pause, and R restart after game over.

- **Testability alone:** Space/Up rotate, arrows move, Q quits. No hard drop,
  pause, or restart implementation.

#### Scoring and speed

- **Combined lens:** 100 / 300 / 500 / 800 points; 1000 ms gravity.

- **Testability alone:** 40 / 100 / 300 / 1200 × level; 500 ms gravity. These
  differ without matching validator requests.

#### 24-row terminal behavior

- **Combined lens:** Uses cursor positioning through row 23; title remains
  visible.

- **Testability alone:** generateFrame returns 24 rows, then render appends a
  newline. In an exactly 24-row viewport, that scrolls the first title row off
  screen. The captured viewport has 23 nonblank rows and no TETRIS title.

#### Other usability detail

- **Combined lens:** Final panel lists implemented actions.

- **Testability alone:** Panel includes a Next piece label with no preview
  content. The testability-only validator did not request a fix.

#### Q exit

- **Combined lens:** Exit code 0; input mode restored.

- **Testability alone:** Exit code 0; input mode restored.

[Testability-only source][source-4] · [Frame tests][source-5] · [Board and
scoring tests][source-6]

### 002 · testability alone · 80 × 24 terminal

```text
+--------------------+
|                    |   Next piece:
|                    |
|                    |
|        [][]        |   Score
|      [][]          |       0
|                    |
|                    |   Lines
|                    |       0
|                    |
|                    |   Level
|                    |    1
|                    |
|                    |   Controls
|                    |   left  - move
|                    |   down  - move
|                    |   right - move
|                    |   space - rotate
|                    |   q     - quit
|                    |
|                    |
+--------------------+
 Controls: Left/Down/Right move   Space: rotate   Q: quit
```

Live npm start capture · quit exit code 0

### Testability-only plan and recorded subtasks

```text
# Tetris plan

From `/workspaces/my-factory-starter/tetris/spec.md`:

- [x] Set up `npm start` entry point.
- [x] Render the complete game display within 24 terminal rows.
- [x] Draw the Tetris board with borders.
- [x] Implement Tetris pieces and their movement.
- [x] Implement line clearing and scoring.
  - [x] Fix single-line-clear test expectation so rows shift down correctly.
- [x] Show score and controls on screen.
- [x] Detect game over and display a game-over message.
```

## Checks and limits

- Factory: cd factory && mix test — 39 examples passed, 0 failures; 7 real-agent
  examples excluded. The excluded Gherkin examples were not run.

- Public entry point: bin/factory with no arguments reported 'a target is
  required'. Both 002 games were then generated through bin/factory with real pi
  calls and reached complete: true.

- tetris-002: six independent Node checks passed for board dimensions,
  deterministic piece generation, collision boundaries, hard-drop floor landing,
  line clearing/scoring, and inspectable board rendering.

- tetris-002: independent ANSI cursor-position checks measured maximum row 23 in
  normal, paused, and game-over rendering.

- tetris-002-testability: npm --prefix tetris/tetris-002-testability test — 10
  tests passed, 0 failures.

- All three npm start commands launched in an 80×24 pseudo-terminal. Sending Q
  exited with code 0 and restored canonical/echo input modes. Live text captures
  appear above.

- The original tetris-001 game and shared seed are unchanged from the
  iteration-002 adoption commit. Both new targets have completed top-level plans
  and no uncommitted target changes.

### How to interpret this comparison

- This is an exploratory comparison, not a controlled causal experiment. Each
  build generated its own plan and code. Shared seed/model settings do not
  remove model variation.

- The combined build exposed factory prompt gaps around completion, current-task
  scope, and the planner/doer handoff. Those prompts were refined during the
  exercise. Several runs resumed saved work, and one silent agent call was
  restarted; the bonus also resumed after a malformed planner result was
  rejected. Timing is not compared.

- No validator-rejection findings are recorded in the testability-only plan. Its
  self-recorded test-expectation fix does not establish an effect of validator
  feedback.

- Validator approval does not imply a defect-free game. The combined game still
  couples some state/rendering to ANSI, has no included working npm test suite,
  and keeps pause/restart coordination in the CLI. The bonus's ten passing tests
  miss its live title-scrolling issue.

- Startup, Q exit, exported rules, and selected rendering states were checked.
  Neither game received a complete human playthrough during this comparison.
  Preferences about feel, readability, and enjoyment remain for you to assess by
  playing.

### Try the games

```sh
npm --prefix tetris/tetris-001 start
npm --prefix tetris/tetris-002 start
npm --prefix tetris/tetris-002-testability start

# Homework suite (excludes real-agent examples)
cd factory && mix test
```

Run each game in a separate terminal. Use its on-screen controls. Choose the
result you prefer based on playing it; the report distinguishes inspected
behavior from that personal judgement.

Sources: [shared seed][source-7] · [combined validator lens][source-8] · game
source and committed plans linked above. All report styling is local; no
external assets or network requests.

## Source links

[source-1]: tetris-001/index.js
[source-2]: tetris-002/index.js
[source-3]: tetris-002/.factory/plan.md
[source-4]: tetris-002-testability/index.js
[source-5]: tetris-002-testability/test/render.test.js
[source-6]: tetris-002-testability/test/board.test.js
[source-7]: spec.md
[source-8]: ../factory/VALIDATOR.md
