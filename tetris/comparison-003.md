# Tetris 003: comparison of all four runs

Date: November 20, 2026. This report compares the preserved builds, their recorded reviews, test results, terminal checks, and available usage data. No game code was changed to prepare it.

## What the experiments showed

- Moving instructions into machine folders worked: the planner, doer, and validator ultimately ran through three different harnesses without changing their roles.
- The broader Kimi validator produced one actionable cursor-lifecycle finding. The Codex validator produced three distinct input/lifecycle findings, all recorded as corrected subtasks.
- Later builds retained executable tests. The original game did not include a test command, despite having callable rules and injectable randomness.
- Test count alone did not establish reliability: the Claude/Kimi build's 30 passing tests missed a split-arrow-input bug that a fresh focused check reproduces.
- There is insufficient whole-run telemetry to rank the four builds by total cost or token efficiency.

These are exploratory results. Independently generated plans, different code, combined harness/model changes, and interrupted runs prevent attributing every difference to a validator or model.

## Run configurations

“Four lenses” means Cockburn's architectural boundaries, Fowler's refactoring approach, Beck's implementation clarity, and Meszaros' test-quality patterns, combined into one report-only validator.

| Build | Planner | Doer | Validator | Review instructions |
|---|---|---|---|---|
| [Original](tetris-003/.factory/plan.md) | pi / Kimi K3.1 Pro* | pi / Kimi K3.1 Pro | pi / Kimi K3.1 Pro | Testability + usability |
| [Reviewed](tetris-003-reviewed/.factory/plan.md) | pi / Kimi K3.1 Pro | pi / Kimi K3.1 Pro | pi / Kimi K3.1 Pro | Four lenses |
| [Claude doer](tetris-003-claude/.factory/plan.md) | pi / Kimi K3.1 Pro | Claude Code / Opus 5.5 | pi / Kimi K3.1 Pro | Four lenses |
| [Codex validator](tetris-003-codex-validator/.factory/plan.md) | pi / Kimi K3.1 Pro | Claude Code / Opus 5.5 | Codex / GPT-6 Sol | Same four-lens prompt |

Exact implementation model IDs were `moonshotai/kimi-k3.1-pro`, `claude-opus-5-5`, and `gpt-6-sol`.

*The original plan was initially written with Kimi K2.7 Code. That model incorrectly reported completion before game implementation. Planner instructions were clarified, and the implementation proceeded after switching all machines to K3.1 Pro. The original is therefore not a clean, single-model run from start to finish.*

All builds used the same [terminal-Tetris seed](spec.md). The original plan had six top-level tasks; each subsequent plan had four. The plans grouped work differently.

## Code quality and behavior

| Dimension | Original | Reviewed | Claude doer | Codex validator |
|---|---|---|---|---|
| Application core | Game rules own timers and import a module that also renders the board | Core has no imports or timer/terminal calls; adapter drives ticks | Core has no imports or timer/terminal calls; entry point owns scheduling | Game rules, application/view, input, loop, renderer, and wiring are separate modules |
| Deterministic seams | Injectable RNG; standalone piece/rule helpers | Injectable randomness and explicit game actions | Injectable randomness; callable input mapping and rendering | Injectable randomness/next-piece source, input stream, application callback, and clock |
| Entry-point import | Guarded; exports key handler | Runs setup at module scope; no exported input handler | Guarded; exports `main` with injectable streams/game | Guarded after validator feedback; exports `run` with injectable streams |
| Retained automated tests | None included | 11 passed | 30 passed | 25 passed, including two PTY end-to-end tests |
| Live 80×24 display | Trailing newline scrolls the score row off-screen | Full display remains visible | Board and side panel remain visible | Board, side panel, and footer remain visible |
| Pause/resume | Implemented; status text can be scrolled away | Not implemented | Implemented and observed in smoke check | Implemented and observed in smoke check |
| Next piece | Shape preview | Letter | Shape preview | Shape preview |
| Rotation | Explicit SRS kick tables | Simple kick offsets | Rotation and wall-kick behavior covered by tests | Rotation and wall-kick behavior covered by tests |
| Smaller terminals | No comparable retained resize check | Standard-size rendering checks | Resize hint instead of a broken board | Resize notice and pause; covered by an end-to-end test |

The most concrete architectural improvement over the original is moving scheduling out of the game core. The Codex-validator build adds useful seams for checking input, elapsed time, application behavior, and lifecycle cleanup independently. Those seams also mean more modules and wiring; their existence is not automatically a quality advantage.

The reviewed build simplifies organization but loses pause and the graphical next-piece preview. Those extras were not required by the seed. Its lack of a guarded entry point is a remaining testability limitation.

### Size context

Physical JavaScript lines include comments and blanks, excluding dependencies and report checks. These measurements describe size, not quality or coverage.

| Build | Production files | Production lines | Test files | Test lines |
|---|---:|---:|---:|---:|
| Original | 4 | 717 | 0 | 0 |
| Reviewed | 3 | 482 | 2 | 209 |
| Claude doer | 4 | 586 | 2 | 364 |
| Codex validator | 6 | 579 | 3 | 452 |

Source entry points: [original](tetris-003/src/index.js), [reviewed](tetris-003-reviewed/src/index.js), [Claude doer](tetris-003-claude/src/index.js), [Codex validator](tetris-003-codex-validator/src/index.js).

## What review feedback actually changed

| Build | Retained validator evidence | Traceable correction |
|---|---|---|
| Original | No findings recorded in the completed plan; no comparable verdict ledger | None established from the retained plan |
| Reviewed | 5 verdicts: 1 rejection and 4 approvals | Move cursor hiding into interactive setup so redirected stdin cannot leave a terminal cursor hidden |
| Claude doer | 4 verdicts, all approvals | No validator-origin correction recorded |
| Codex validator | 8 verdicts: 4 rejections and 4 approvals | Three distinct issues corrected; the shutdown issue was reported twice across a resume |

The three Codex findings were:

1. **Split terminal sequences:** preserve incomplete escape sequences across input events so a fragmented left arrow is not interpreted as another action.
2. **Import side effects:** only launch the application when its entry point is executed directly, rather than whenever it is imported.
3. **Shutdown cleanup:** remove this run's signal and exception listeners so a completed run cannot swallow a later signal or mishandle a later exception.

The first pass hit its three-attempt limit before the third correction. It resumed on the same target with `--attempts 6`; acceptance criteria were unchanged. Four rejections therefore do not mean four unique problems.

The reviewed build's core separation and explicit testing task existed before its first rejection. Those improvements cannot be credited to validator feedback alone. Likewise, zero rejections in the Claude/Kimi run does not establish defect-free code.

### Fresh cross-build input check

While preparing this report, a non-mutating Node probe fed two chunks—`ESC [` followed by `D`—to each applicable input boundary:

| Build | Observed actions | Assessment |
|---|---|---|
| Claude doer | `quit`, then `moveRight` | Incorrect interpretation of a split left arrow |
| Codex validator | `left` | Correct buffering and interpretation |

The probe used the Claude build's `parseKeys` on each chunk and an `EventEmitter` stream through the Codex build's `startInput`. It exercised the real parsing paths without launching either game. See [Claude input](tetris-003-claude/src/input.js) and [Codex-build input](tetris-003-codex-validator/src/input.js).

This establishes a concrete remaining problem in the Claude/Kimi build and a corrected behavior in the Codex-validator build. It does not establish a general ranking of the models: they reviewed independently generated implementations.

## Token usage and spend

Only the reviewed run has a retained whole-run usage ledger. The Codex-validator experiment has a validator-only subtotal recovered from its eight Codex session records.

| Build | Whole-run tokens | Whole-run reported USD | Validator-only tokens | Validator-only reported USD |
|---|---:|---:|---:|---:|
| Original | Unavailable | Unavailable | Unavailable | Unavailable |
| Reviewed | 622,382 | $0.816409 | 235,601 | $0.231341 |
| Claude doer | No comparable whole-run ledger | Unavailable | Unavailable | Unavailable |
| Codex validator | Unavailable | Unavailable | 816,728 | Unavailable |

**Unavailable does not mean zero.** No complete cost difference, saving, or quality-per-dollar ranking can be calculated across all four runs.

### Reviewed run: complete captured factory usage

| Machine | Calls | Tokens including cache | Provider-reported USD |
|---|---:|---:|---:|
| Planner | 10 | 50,419 | $0.077434 |
| Doer | 6 | 336,362 | $0.507634 |
| Validator | 5 | 235,601 | $0.231341 |
| Total | 21 | 622,382 | $0.816409 |

The ledger contains 97 assistant-message usage records, with no missing usage/cost fields. Totals include an interrupted doer attempt and the resume caused by a pipe-write failure in the usage observer. That overhead is part of the measured run. Amounts are emitted provider-reported costs, not a billing invoice or estimates from public rates.

### Codex validator: partial experiment usage

| Field | Tokens |
|---|---:|
| Input, including cached input | 802,895 |
| Cached input, already included above | 683,904 |
| Output | 13,833 |
| Total input + output | 816,728 |
| Reasoning output, already included in output | 8,317 |

These figures exclude the planner, Claude doer, readiness probe, report preparation, and orchestration. They include rejected reviews and the resumed pass. Cached input must not be added a second time. No dollar cost was inferred for these sessions.

The validator subtotals describe their respective workloads; they do not isolate model efficiency. The models reviewed different plans and code, made different numbers of calls, and used different harness accounting. The full reviewed-run total must not be compared as if it covered the same scope as the Codex validator-only subtotal.

## Verification and limitations

The recorded independent executions of the included suites passed 11, 30, and 25 tests respectively for the reviewed, Claude, and Codex-validator builds. The original has no included suite; ten retained external comparison checks passed. Ten external checks also passed for the reviewed build. These checks are selected examples, not coverage measurements or identical cross-build suites.

All four launches passed Q-exit smoke checks with exit code 0 and restored canonical input/echo settings. Pause was observed in both Claude-produced builds. The terminal reconstruction used for those captures does not implement every escape sequence; it recorded an unhandled clear-to-end sequence in both Claude-produced builds. Their included rendering tests provide additional evidence, and the Codex build's end-to-end tests exercise actual PTYs.

The Codex build's two end-to-end tests depend on util-linux `script` and skip themselves if it is unavailable. Both ran in the recorded 25-test execution: zero tests were skipped. They include timed input and random gameplay; a passing run does not establish that they can never be flaky.

The Codex experiment also required removing the obsolete `--full-auto` CLI flag. Its initial read-only sandbox could not create user namespaces in this container, so later reviews used host execution with report-only instructions. This environment difference and the resumed pass are additional comparison limits.

The factory homework suite passed 43 examples with 8 real-agent examples excluded. The factory runs described here were deliberate real-agent experiments, not executions of those excluded Gherkin examples. This report reused the saved suite results and added the focused split-input probe; it did not rerun the complete test suites or edit the generated games.

## Practical conclusion

- **Original:** useful baseline for callable game rules, but no included tests and a reproducible live display defect.
- **Reviewed:** cleaner core separation and retained tests, with one feedback-driven cursor correction; fewer optional gameplay features.
- **Claude doer:** richer terminal presentation and the largest test count, but a split-input bug remains despite validator approval.
- **Codex validator:** the strongest retained evidence here for input/lifecycle correctness, including three recorded corrections and PTY tests. More review effort and a resumed pass were required; total dollar spend is unknown.

For a more controlled follow-up, give both validators the same frozen diff and plan, change only the reviewer configuration, and capture usage for every call. That would better compare review findings and spend without differences from fresh planning and implementation.

## Evidence and commands

- [Earlier two-build HTML report](comparison-003.html)
- [Reviewed-run manifest](reports/tetris-003-review/manifest.json), [usage ledger](reports/tetris-003-review/usage.jsonl), and [usage summary](reports/tetris-003-review/usage-summary.json)
- [Claude-doer experiment](reports/tetris-003-claude/experiment.json) and [test output](reports/tetris-003-claude/tests.txt)
- [Codex-validator experiment](reports/tetris-003-codex-validator/experiment.json), [validator token records](reports/tetris-003-codex-validator/validator-usage.json), and [test output](reports/tetris-003-codex-validator/tests.txt)
- [Four-lens validator prompt used in the experiments](reports/tetris-003-review/validator-instructions.md)

Run each game separately and use its displayed controls:

```sh
npm --prefix tetris/tetris-003 start
npm --prefix tetris/tetris-003-reviewed start
npm --prefix tetris/tetris-003-claude start
npm --prefix tetris/tetris-003-codex-validator start
```

Run the included game suites:

```sh
npm --prefix tetris/tetris-003-reviewed test
npm --prefix tetris/tetris-003-claude test
npm --prefix tetris/tetris-003-codex-validator test
```
