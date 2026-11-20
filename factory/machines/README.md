# Machine configuration

Each machine has an `AGENTS.md` and a `machine.json`. Edit its instructions
or configuration here; the factory's code does not choose its role or lens.

`machine.json` accepts:

- `harness`: `pi` (the default), `claude`, `codex`, or a path to a
  pi-compatible executable. Relative paths are relative to this machine's folder.
- `provider`: pi's provider, defaulting to `anthropic`.
- `model`: an optional model passed to the harness.
- `api_key_env`: an optional provider API key environment-variable name for pi.

For example:

```json
{"harness":"pi","provider":"anthropic","model":"<your model>"}
```

Every machine needs its own login file: copy `~/.pi/agent/auth.json`,
`~/.claude/.credentials.json`, or `~/.codex/auth.json` into its folder,
according to its harness. Alternatively, set the provider's API key in the
environment. Codex uses `CODEX_API_KEY`; Claude uses `ANTHROPIC_API_KEY`.
The factory checks all three machines before calling any of them.

The per-machine `.gitignore` keeps logins, sessions, and caches out of Git.
Only authored configuration files are allowed through it. Refresh a copied
login if it stops working.

`CLAUDE.md` imports `AGENTS.md` for Claude. `config.toml` disables project
instruction discovery for Codex. pi receives `--no-context-files` and an
explicit path to this machine's `AGENTS.md`. Each harness runs with the target
as its working directory and this machine's folder as its configuration directory.
