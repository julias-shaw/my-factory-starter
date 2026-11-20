# Assembly line

The factory runs `careful/assembly-line.dot`. Its machine folders moved from
`factory/machines/` to `careful/machines/`, including their local logins.
Edit the graph to change the route; machine instructions and harness settings
remain in each machine's folder.

The supported DOT notation is a `digraph` containing directed edges between
unquoted machine names, with optional semicolons and `label="field"` or
`label="not field"` attributes. Unlabelled edges always run. `start` begins the
line; only `planner` can lead to `finish`. Every node must be able to reach
`finish`, and every machine must have an `AGENTS.md` in its folder.

The runner asks machines for the boolean fields their outgoing edges need.
The validator also returns `findings`, passed to the next doer attempt.
Returning to the planner accepts and commits the work before it marks the
task done; its plan update is committed too. The factory never reads the plan.
The orchestrator limits each task to three doer attempts by default;
`--attempts N` changes this limit. Failed attempts remain uncommitted.

From the repository root:

```sh
bin/factory --seed tetris/spec.md --target tetris/tetris-004
npm --prefix tetris/tetris-004 start
```

Each invocation runs the whole line until the planner reports completion.
The former `--all` option is no longer used. To skip validation, remove the
three edges involving `validator` and add `doer -> planner`.
