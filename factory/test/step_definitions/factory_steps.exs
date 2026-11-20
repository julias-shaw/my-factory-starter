defmodule FactorySteps do
  use Cucumber.StepDefinition
  import ExUnit.Assertions

  step "a copy of the factory", context do
    workspace =
      Path.join(
        System.tmp_dir!(),
        "factory-#{System.pid()}-#{System.unique_integer([:positive])}"
      )

    source = Path.expand("../..", __DIR__)
    copy = Path.join(workspace, "factory")
    File.mkdir_p!(copy)
    ExUnit.Callbacks.on_exit(fn -> File.rm_rf!(workspace) end)

    for path <- ["run", "cli.exs", "lib"] do
      File.cp_r!(Path.join(source, path), Path.join(copy, path))
    end

    # Copy authored configuration only; never copy the student's credentials or sessions.
    for path <- Path.wildcard(Path.join(source, "assembly-lines/**/*"), match_dot: true),
        File.regular?(path),
        Path.basename(path) in [
          "assembly-line.dot",
          "AGENTS.md",
          "CLAUDE.md",
          "machine.json",
          "settings.json",
          ".gitignore",
          "config.toml",
          "README.md"
        ] do
      destination = Path.join(copy, Path.relative_to(path, source))
      File.mkdir_p!(Path.dirname(destination))
      File.cp!(path, destination)
    end

    git!(workspace, ["init", "-q"])
    git!(workspace, ["config", "user.email", "factory@example.test"])
    git!(workspace, ["config", "user.name", "Factory Test"])
    git!(workspace, ["add", "."])
    git!(workspace, ["commit", "-qm", "Initial factory"])

    Map.merge(context, %{
      workspace: workspace,
      factory: copy,
      baseline: git!(workspace, ["rev-parse", "HEAD"])
    })
  end

  step "a new target", context do
    Map.put(context, :target, Path.join(context.workspace, "target"))
  end

  step "a seed describing a game of Tetris", context do
    seed = Path.join(context.workspace, "seed.md")
    File.write!(seed, "Build a game of Tetris in the terminal.\n")
    Map.put(context, :seed, seed)
  end

  step "the planner plans the tasks alpha and beta", context do
    agent_dir = Path.join(context.workspace, "agents")
    File.mkdir_p!(agent_dir)
    agent = Path.join(agent_dir, "pi")
    File.cp!(Path.expand("../doubles/agent", __DIR__), agent)
    File.chmod!(agent, 0o755)

    chosen_dir = Path.join(context.workspace, "chosen-agent")
    File.mkdir_p!(chosen_dir)
    chosen = Path.join(chosen_dir, "agent")
    File.cp!(agent, chosen)
    File.chmod!(chosen, 0o755)

    for role <- ["planner", "doer", "validator"] do
      folder = Path.join(context.factory, "assembly-lines/careful/machines/#{role}")

      File.write!(
        Path.join(folder, "machine.json"),
        IO.iodata_to_binary(:json.encode(%{"harness" => chosen, "provider" => "anthropic"}))
      )
    end

    context =
      if context[:unrelated], do: Map.put(context, :unrelated, unrelated(context)), else: context

    Map.merge(context, %{
      harness: chosen,
      chosen_dir: chosen_dir,
      agent: agent,
      agent_dir: agent_dir,
      agent_env: [
        {"PATH", agent_dir <> ":" <> System.get_env("PATH")},
        {"ANTHROPIC_API_KEY", "test-key"}
      ]
    })
  end

  step "no harness is chosen for the validator", context do
    configure(context, "validator", %{"provider" => "anthropic"})
  end

  step "the factory runs", context do
    run_factory(context)
  end

  step "pi has been called", context do
    assert Path.wildcard(Path.join(context.agent_dir, "call-*.args")) != []
    context
  end

  step "the chosen agent has been called", context do
    assert calls(context) != []
    context
  end

  step "pi has not been called", context do
    assert Path.wildcard(Path.join(context.agent_dir, "call-*.args")) == []
    context
  end

  step "the agent cannot be run", context do
    Map.put(context, :harness, Path.join(context.workspace, "missing-agent"))
  end

  step "no plan", context do
    File.rm(plan(context))
    context
  end

  step "there is no plan", context do
    refute File.exists?(plan(context))
    context
  end

  step "it reports that it could not run the agent", context do
    assert context.status != 0
    assert context.output =~ "could not run the agent"
    context
  end

  step "there are no new commits", context do
    assert git!(context.workspace, ["rev-parse", "HEAD"]) == context.before_run_head
    context
  end

  step "the plan has the tasks {string} and {string}, and no others", %{args: [a, b]} = context do
    assert Enum.map(tasks(context), &elem(&1, 0)) == [a, b]
    context
  end

  step "a plan with three tasks, none of them done", context do
    put_plan(context, "- [ ] alpha\n- [ ] beta\n- [ ] gamma\n")
  end

  step "a plan whose first task is done", context do
    put_plan(context, "- [x] alpha\n- [ ] beta\n- [ ] gamma\n")
  end

  step "a plan in which every task is done", context do
    put_plan(context, "- [x] alpha\n- [x] beta\n")
  end

  step "the doer writes a file called SENTINEL", context do
    set_mode(context, "doer", "sentinel")
  end

  step "there is one new work commit", context do
    assert length(work_commits(context)) == 1
    context
  end

  step "its only product file is SENTINEL", context do
    [commit] = work_commits(context)
    assert product_files(context, commit) == ["SENTINEL"]
    assert File.read!(Path.join(context.target, "SENTINEL")) == "Work for alpha\n"
    context
  end

  step "the doer was pointed at the plan and at the seed", context do
    [call | _] = calls(context, "doer")
    args = File.read!(call)
    assert args =~ context.seed
    assert args =~ plan(context)
    assert File.read!(String.replace_suffix(call, ".args", ".cwd")) == context.target
    context
  end

  step "the planner was called before the doer", context do
    roles =
      File.read!(Path.join(context.chosen_dir, "calls.log")) |> String.split("\n", trim: true)

    planner = Enum.find_index(roles, &(&1 == "planner"))
    doer = Enum.find_index(roles, &(&1 == "doer"))
    assert is_integer(planner) and is_integer(doer)
    assert planner < doer
    context
  end

  step "the planner was asked for a result with the field {string}", %{args: [field]} = context do
    [call | _] = calls(context, "planner")
    args = File.read!(call)
    assert args =~ "JSON"
    assert args =~ field
    context
  end

  step "the validator says {string} before its result", %{args: [prose]} = context do
    File.write!(Path.join(context.chosen_dir, "validator-preamble"), prose)
    context
  end

  step "the factory runs to completion", context do
    run_factory(context)
  end

  step "the agent has been called once", context do
    assert length(calls(context)) == 1
    context
  end

  step "the factory has stopped", context do
    assert context.status == Map.get(context, :expected_status, 0), context.output
    context
  end

  step "the plan shows the first task as done", context do
    assert [{"alpha", true} | _] = tasks(context)
    context
  end

  step "the plan shows the other two as not done", context do
    assert tasks(context) == [{"alpha", true}, {"beta", false}, {"gamma", false}]
    context
  end

  step "it contains the work for the first task", context do
    [commit] = work_commits(context)
    assert product_files(context, commit) == ["alpha.txt"]

    assert git!(context.target, ["show", "#{commit}:#{target_prefix(context)}alpha.txt"]) ==
             "Work for alpha"

    context
  end

  step "it contains the work for the second task", context do
    [commit] = work_commits(context)
    assert product_files(context, commit) == ["beta.txt"]

    assert git!(context.target, ["show", "#{commit}:#{target_prefix(context)}beta.txt"]) ==
             "Work for beta"

    context
  end

  step "the plan shows every task as done", context do
    assert tasks(context) != []
    assert Enum.all?(tasks(context), fn {_, done} -> done end)
    context
  end

  step "there are three new work commits", context do
    assert length(work_commits(context)) == 3
    context
  end

  step "the validator answers in prose, with no result", context do
    set_mode(context, "validator", "prose-result")
  end

  step "it reports that it could not read the validator's result", context do
    assert context.status != 0
    assert context.output =~ "could not read the validator's result"
    Map.put(context, :expected_status, 1)
  end

  step "no seed is chosen", context do
    Map.put(context, :seed, nil)
  end

  step "the seed has been deleted", context do
    File.rm!(context.seed)
    context
  end

  step "it reports that there is no seed", context do
    assert context.status != 0
    assert context.output =~ "no seed"
    context
  end

  step "no agent has been called", context do
    assert calls(context) == []
    assert Path.wildcard(Path.join(context.agent_dir, "call-*.args")) == []
    context
  end

  step "there is a plan", context do
    assert File.regular?(plan(context))
    context
  end

  step "the plan shows every task as not done", context do
    assert tasks(context) != []
    refute Enum.any?(tasks(context), fn {_, done} -> done end)
    context
  end

  step "there are no new work commits", context do
    assert work_commits(context) == []
    context
  end

  step "the committed plan matches the plan on disk", context do
    committed = git!(context.target, ["show", "HEAD:#{target_prefix(context)}.factory/plan.md"])
    assert committed == String.trim(File.read!(plan(context)))
    context
  end

  step "the target has no uncommitted changes", context do
    assert git!(context.target, ["status", "--porcelain", "--", "."]) == ""
    context
  end

  step "the plan still has those three tasks", context do
    assert Enum.map(tasks(context), &elem(&1, 0)) == ["alpha", "beta", "gamma"]
    context
  end

  step ~r/^the plan is \.factory\/plan\.md in the target$/, context do
    assert File.regular?(plan(context))
    context
  end

  step "there is no plan in the factory's folder", context do
    refute File.exists?(Path.join(context.factory, ".factory/plan.md"))
    context
  end

  step "the plan shows the first two tasks as done", context do
    assert tasks(context) == [{"alpha", true}, {"beta", true}, {"gamma", false}]
    context
  end

  step "the planner keeps its plan in prose", context do
    set_mode(context, "planner", "prose-plan")
  end

  step "the work for alpha and beta has been committed", context do
    assert length(work_commits(context)) == 2

    for task <- ["alpha", "beta"] do
      assert git!(context.target, ["show", "HEAD:#{target_prefix(context)}#{task}.txt"]) ==
               "Work for #{task}"
    end

    assert File.read!(plan(context)) == "All work is finished.\n"
    context
  end

  step "the factory has staged and unstaged changes", context do
    File.write!(Path.join(context.workspace, "unrelated.txt"), "original\n")
    git!(context.workspace, ["add", "unrelated.txt"])
    git!(context.workspace, ["commit", "-qm", "Unrelated baseline"])

    for file <- [
          Path.join(context.factory, "cli.exs"),
          Path.join(context.workspace, "unrelated.txt")
        ] do
      File.write!(file, "\n# staged change\n", [:append])
    end

    git!(context.workspace, ["add", "factory/cli.exs", "unrelated.txt"])

    for file <- [
          Path.join(context.factory, "cli.exs"),
          Path.join(context.workspace, "unrelated.txt")
        ] do
      File.write!(file, "\n# unstaged change\n", [:append])
    end

    Map.merge(context, %{
      unrelated: unrelated(context),
      baseline: git!(context.workspace, ["rev-parse", "HEAD"])
    })
  end

  step "no target is chosen", context do
    Map.put(context, :target, nil)
  end

  step "it reports that a target is required", context do
    assert context.status != 0
    assert context.output =~ "target is required"
    context
  end

  step "the factory's own files and unrelated uncommitted changes are as they were", context do
    assert unrelated(context) == context.unrelated
    context
  end

  step "the target folder does not exist", context do
    refute File.exists?(context.target)
    context
  end

  step "the target uses the containing repository", context do
    assert git!(context.target, ["rev-parse", "--show-toplevel"]) == context.workspace
    refute File.exists?(Path.join(context.target, ".git"))
    context
  end

  step "the target is outside any Git repository", context do
    target =
      Path.join(
        System.tmp_dir!(),
        "standalone-#{System.pid()}-#{System.unique_integer([:positive])}"
      )

    ExUnit.Callbacks.on_exit(fn -> File.rm_rf!(target) end)
    Map.put(context, :target, target)
  end

  step "the target is a Git repository", context do
    assert File.dir?(Path.join(context.target, ".git"))
    assert git!(context.target, ["rev-parse", "--show-toplevel"]) == context.target
    context
  end

  step "the factory builds the target {string} to completion", %{args: [name]} = context do
    context = Map.put(context, :target, Path.join(context.workspace, name))
    context = run_factory(context)
    assert context.status == 0, context.output
    saved = Map.put_new(context[:snapshots] || %{}, name, snapshot(context.target))
    Map.put(context, :snapshots, saved)
  end

  step "the factory builds the same target using its absolute path", context do
    run_factory(Map.put(context, :absolute_target, true))
  end

  step "the target {string} is unchanged", %{args: [name]} = context do
    assert snapshot(Path.join(context.workspace, name)) == context.snapshots[name]
    context
  end

  step "the targets {string} and {string} each have their own completed plan and committed work",
       %{args: [a, b]} = context do
    for name <- [a, b] do
      target = Path.join(context.workspace, name)
      c = Map.put(context, :target, target)
      assert tasks(c) == [{"alpha", true}, {"beta", true}]
      assert length(work_commits(c)) == 2
      assert git!(target, ["status", "--porcelain", "--", "."]) == ""

      for task <- ["alpha", "beta"] do
        assert git!(target, ["show", "HEAD:#{target_prefix(c)}#{task}.txt"]) == "Work for #{task}"
      end

      assert git!(target, ["show", "HEAD:#{target_prefix(c)}.factory/plan.md"]) ==
               String.trim(File.read!(plan(c)))
    end

    context
  end

  step "the doer does the next task in the plan", context do
    set_mode(context, "doer", "normal")
  end

  step "the validator is always satisfied", context do
    set_mode(context, "validator", "satisfied")
  end

  step "the doer's chosen harness has been called", context do
    assert calls(context, "doer") != []
    context
  end

  step "the doer cannot be run", context do
    configure(context, "doer", %{
      "harness" => Path.join(context.workspace, "missing-doer"),
      "provider" => "anthropic"
    })
  end

  step "it reports that it could not run the doer", context do
    assert context.status != 0
    assert context.output =~ "could not run the doer"
    context
  end

  step "the factory allows at most three attempts at a task", context do
    Map.put(context, :attempts, 3)
  end

  step "the validator is never satisfied", context do
    set_mode(context, "validator", "never")
  end

  step "the validator is not satisfied the first time", context do
    set_mode(context, "validator", "retry")
  end

  step "the doer has been called once", context do
    assert length(calls(context, "doer")) == 1
    context
  end

  step "the doer has been called twice", context do
    assert length(calls(context, "doer")) == 2
    context
  end

  step "the doer has been called three times", context do
    assert length(calls(context, "doer")) == 3
    context
  end

  step "the doer has not been called", context do
    assert calls(context, "doer") == []
    context
  end

  step "it reports that a task hit its limit", context do
    assert context.status != 0
    assert context.output =~ "task hit its limit"
    Map.put(context, :expected_status, 1)
  end

  step "the validator was asked for a result with the fields {string} and {string}",
       %{args: [a, b]} = context do
    [call | _] = calls(context, "validator")
    prompt = File.read!(call)
    assert prompt =~ "JSON"
    assert prompt =~ a
    assert prompt =~ b
    context
  end

  step "the doer keeps its plan in prose", context do
    set_mode(context, "doer", "prose-plan")
  end

  step "the validator's lens is testability", context do
    instructions(context, "validator", "testability")
  end

  step "the validator was given {string}", %{args: [lens]} = context do
    [call | _] = calls(context, "validator")
    assert File.read!(call) =~ lens
    context
  end

  step "the doer's AGENTS.md says {string}", %{args: [text]} = context do
    instructions(context, "doer", text)
  end

  step "the validator's AGENTS.md says {string}", %{args: [text]} = context do
    instructions(context, "validator", text)
  end

  step "the doer was given {string}", %{args: [text]} = context do
    [call | _] = calls(context, "doer")
    assert File.read!(call) =~ text
    context
  end

  step "it was not given {string}", %{args: [text]} = context do
    [call | _] = calls(context, "validator")
    refute File.read!(call) =~ text
    context
  end

  step "the doer has its own login", context do
    File.write!(
      Path.join(context.factory, "assembly-lines/careful/machines/doer/auth.json"),
      "{\"test\":true}"
    )

    context
  end

  step "the doer has no login", context do
    File.rm(Path.join(context.factory, "assembly-lines/careful/machines/doer/auth.json"))
    context
  end

  step "there is an API key for the doer's provider", context do
    Map.put(
      context,
      :agent_env,
      List.keystore(context.agent_env, "ANTHROPIC_API_KEY", 0, {"ANTHROPIC_API_KEY", "test-key"})
    )
  end

  step "there is no API key for the doer's provider", context do
    for role <- ["planner", "validator"] do
      File.write!(
        Path.join(context.factory, "assembly-lines/careful/machines/#{role}/auth.json"),
        "{}"
      )
    end

    Map.put(
      context,
      :agent_env,
      List.keystore(context.agent_env, "ANTHROPIC_API_KEY", 0, {"ANTHROPIC_API_KEY", nil})
    )
  end

  step "the doer signed in with its own login", context do
    [call | _] = calls(context, "doer")
    assert File.read!(String.replace_suffix(call, ".args", ".login")) == "login"
    context
  end

  step "the doer signed in with the API key", context do
    [call | _] = calls(context, "doer")
    assert File.read!(String.replace_suffix(call, ".args", ".login")) == "api-key"
    context
  end

  step "the doer's login is ignored by Git", context do
    assert git!(context.workspace, [
             "check-ignore",
             "factory/assembly-lines/careful/machines/doer/auth.json"
           ]) ==
             "factory/assembly-lines/careful/machines/doer/auth.json"

    context
  end

  step "it reports that the doer cannot sign in", context do
    assert context.status != 0
    assert context.output =~ "doer cannot sign in"
    context
  end

  step "the doer was given the validator's findings", context do
    prompts = Enum.map(calls(context, "doer"), &File.read!/1)
    assert Enum.any?(prompts, &String.contains?(&1, "Separate game logic from terminal input"))
    context
  end

  step "the validator was given the work for the second task", context do
    [call | _] = calls(context, "validator")
    assert File.read!(call) =~ "beta.txt"
    assert File.read!(call) =~ "Work for beta"
    context
  end

  step "it was not given the work for the first task", context do
    [call | _] = calls(context, "validator")
    refute File.read!(call) =~ "alpha.txt"
    refute File.read!(call) =~ "Work for alpha"
    context
  end

  step "this assembly line:", context do
    File.write!(line_path(context), context.docstring)
    context
  end

  step "the factory reads the assembly line", context do
    Map.put(context, :line_result, Factory.AssemblyLine.load(Path.dirname(line_path(context))))
  end

  step "it accepts it", context do
    assert {:ok, _} = context.line_result
    context
  end

  step "it refuses it", context do
    assert {:error, _} = context.line_result
    context
  end

  step "the validator has been taken out, so the doer goes straight to the planner", context do
    source = File.read!(line_path(context))
    source = Regex.replace(~r/^.*validator.*\n?/m, source, "")
    source = String.replace(source, "}", "  doer -> planner\n}")
    File.write!(line_path(context), source)
    context
  end

  step "{string} is misspelt {string} throughout the assembly line",
       %{args: [from, to]} = context do
    File.write!(line_path(context), String.replace(File.read!(line_path(context)), from, to))
    context
  end

  step "the edge from validator to planner has been taken out", context do
    source =
      Regex.replace(
        ~r/^\s*validator\s*->\s*planner[^\n]*\n?/m,
        File.read!(line_path(context)),
        ""
      )

    File.write!(line_path(context), source)
    context
  end

  step "it reports that it has no machine called {string}", %{args: [name]} = context do
    assert {:error, message} = context.line_result
    assert message =~ "no machine called #{name}"
    context
  end

  step "it reports that finish cannot be reached from validator", context do
    assert {:error, message} = context.line_result
    assert message =~ "finish cannot be reached from validator"
    context
  end

  step "the edges from validator are labelled {string} and {string}",
       %{args: [positive, negative]} = context do
    source = File.read!(line_path(context))

    source =
      String.replace(source, "not satisfied", negative)
      |> String.replace(~s(label="satisfied"), ~s(label="#{positive}"))

    File.write!(line_path(context), source)
    context
  end

  step "the validator has not been called", context do
    assert calls(context, "validator") == []
    context
  end

  step "the doer has been called four times", context do
    assert length(calls(context, "doer")) == 4
    context
  end

  step "each new work commit contains the work for one task", context do
    commits = work_commits(context)

    assert Enum.sort(Enum.map(commits, &product_files(context, &1))) == [
             ["alpha.txt"],
             ["beta.txt"],
             ["gamma.txt"]
           ]

    for commit <- commits do
      [file] = product_files(context, commit)
      task = Path.rootname(file)

      assert git!(context.target, ["show", "#{commit}:#{target_prefix(context)}#{file}"]) ==
               "Work for #{task}"
    end

    context
  end

  step "there are two new work commits", context do
    assert length(work_commits(context)) == 2
    context
  end

  step "no new commit contains the work for the first task", context do
    refute Enum.any?(work_commits(context), &("alpha.txt" in product_files(context, &1)))
    context
  end

  step "it reports that the result of validator has no field {string}",
       %{args: [field]} = context do
    assert context.status != 0
    assert context.output =~ "result of validator has no field #{inspect(field)}"
    context
  end

  defp line_path(context),
    do: Path.join(context.factory, "assembly-lines/careful/assembly-line.dot")

  defp calls(context, role) do
    Path.wildcard(Path.join(context.chosen_dir, "call-#{role}-*.args"))
  end

  defp run_factory(context) do
    head = git!(context.workspace, ["rev-parse", "HEAD"])

    args =
      if context.seed, do: ["--seed", Path.relative_to(context.seed, context.workspace)], else: []

    args =
      if context.target,
        do:
          args ++
            [
              "--target",
              if(context[:absolute_target],
                do: context.target,
                else: Path.relative_to(context.target, context.workspace)
              )
            ],
        else: args

    args = args ++ ["--attempts", to_string(context[:attempts] || 3)]

    env =
      context.agent_env ++
        [
          {"GIT_AUTHOR_NAME", "Factory Test"},
          {"GIT_AUTHOR_EMAIL", "factory@example.test"},
          {"GIT_COMMITTER_NAME", "Factory Test"},
          {"GIT_COMMITTER_EMAIL", "factory@example.test"}
        ]

    {output, status} =
      System.cmd("timeout", ["30s", Path.join(context.factory, "run") | args],
        cd: context.workspace,
        env: env,
        stderr_to_stdout: true
      )

    Map.merge(context, %{output: output, status: status, before_run_head: head})
  end

  defp configure(context, role, config) do
    File.write!(
      Path.join(context.factory, "assembly-lines/careful/machines/#{role}/machine.json"),
      IO.iodata_to_binary(:json.encode(config))
    )

    context
  end

  defp instructions(context, role, text) do
    File.write!(
      Path.join(context.factory, "assembly-lines/careful/machines/#{role}/AGENTS.md"),
      text
    )

    context
  end

  defp plan(context), do: Path.join(context.target, ".factory/plan.md")

  defp calls(context), do: Path.wildcard(Path.join(context.chosen_dir, "call-*.args"))

  defp put_plan(context, contents) do
    File.mkdir_p!(Path.dirname(plan(context)))
    File.write!(plan(context), contents)
    git!(context.workspace, ["add", "--", context.target])
    git!(context.workspace, ["commit", "-qm", "Existing plan", "--", context.target])
    Map.put(context, :baseline, git!(context.workspace, ["rev-parse", "HEAD"]))
  end

  defp tasks(context) do
    Regex.scan(~r/^- \[( |x)\] (.+)$/m, File.read!(plan(context)))
    |> Enum.map(fn [_, mark, task] -> {task, mark == "x"} end)
  end

  defp set_mode(context, role, mode) do
    File.write!(Path.join(context.chosen_dir, role <> "-mode"), mode)
    context
  end

  defp git!(cwd, args) do
    {out, status} = System.cmd("git", args, cd: cwd, stderr_to_stdout: true)
    assert status == 0, "git #{inspect(args)} failed: #{out}"
    String.trim(out)
  end

  defp target_prefix(context) do
    prefix = git!(context.target, ["rev-parse", "--show-prefix"])
    prefix
  end

  defp work_commits(context) do
    git!(context.target, ["log", "--format=%H", "#{context.baseline}..HEAD", "--", "."])
    |> String.split("\n", trim: true)
    |> Enum.filter(&(product_files(context, &1) != []))
  end

  defp product_files(context, commit) do
    git!(context.target, [
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "--relative",
      commit,
      "--",
      "."
    ])
    |> String.split("\n", trim: true)
    |> Enum.reject(&String.starts_with?(&1, ".factory/"))
  end

  defp unrelated(context) do
    for args <- [["diff", "--cached", "--binary"], ["diff", "--binary"]] do
      git!(context.workspace, args ++ ["--", "factory", "unrelated.txt"])
    end
  end

  defp snapshot(target) do
    Path.wildcard(Path.join(target, "**/*"), match_dot: true)
    |> Enum.filter(&File.regular?/1)
    |> Map.new(fn path -> {Path.relative_to(path, target), File.read!(path)} end)
  end
end
