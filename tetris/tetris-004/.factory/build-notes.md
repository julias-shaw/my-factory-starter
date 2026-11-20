# Tetris 004 build notes

The iteration 004 factory built this target from `tetris/spec.md` using the
`careful` assembly line. All four top-level plan tasks are complete.

## Runs

```sh
bin/factory --seed tetris/spec.md --target tetris/tetris-004
bin/factory --seed tetris/spec.md --target tetris/tetris-004 --attempts 6
```

The first run exhausted its default three attempts on terminal startup and
input handling. Validation found split arrow sequences, modified escape
sequences, and missing cleanup when stdin closes. The second run resumed the
same target and completed the plan. The factory's final plan commit is
`a0de784`.

## Follow-up verification and fix

After the factory finished, independent verification reproduced the stdin
EOF issue: the gravity timer kept the game running after its input closed.
A follow-up change routes stdin `end` through the existing exit function,
which clears the timer and restores the terminal. The new subprocess test
failed before the fix and passed afterward.

- `npm --prefix tetris/tetris-004 test`: 37 tests passed, zero failures.
- `npm --prefix tetris/tetris-004 start` in an 80-column, 24-row pseudo-terminal:
  startup, arrow controls, hard drop, pause/resume, game over, restart, and
  `q` quit passed; the original screen was restored and exit status was zero.
- Captured frames used at most 22 rows and 43 columns.

## Factory issue exposed by the run

On resumption, the initial planner visit committed the existing, unaccepted
work (`0f0b1ff`) before validation. The next validator therefore received an
empty diff and approved it without resolving the previous EOF finding.
Independent follow-up verification caught and fixed that remaining game bug.

The factory itself was not changed during this build. A useful next factory
regression test is: resume a target with rejected, uncommitted work and verify
that the work stays visible to validation and uncommitted until accepted.
The validator also requested marking a verification task done, despite that
being the planner's responsibility; the doer correctly left the top-level
checkbox for the planner and recorded its verification as a subtask.
