defmodule Factory.AgentOutput do
  defstruct events: false

  def consume(line, answer) do
    event =
      try do
        :json.decode(line)
      rescue
        _ -> nil
      end

    case event do
      %{
        "type" => "message_update",
        "assistantMessageEvent" => %{"type" => "text_delta", "delta" => delta}
      } ->
        IO.binwrite(:stderr, delta)
        answer

      %{
        "type" => "message_end",
        "message" => %{"role" => "assistant", "content" => content} = message
      } ->
        IO.puts(:stderr, "")
        if message["errorMessage"], do: IO.puts(:stderr, message["errorMessage"])
        content |> Enum.filter(&(&1["type"] == "text")) |> Enum.map_join("\n", & &1["text"])

      %{"type" => "tool_execution_start", "toolName" => name} ->
        IO.puts(:stderr, "\n[tool: #{name}]")
        answer

      %{"type" => "tool_execution_end", "toolName" => name, "isError" => error} ->
        IO.puts(:stderr, "[#{name}: #{if error, do: "failed", else: "done"}]")
        answer

      %{"type" => "agent_start"} ->
        IO.puts(:stderr, "[agent started]")
        answer

      %{"type" => _} ->
        answer

      _ ->
        IO.puts(:stderr, line)
        answer <> line <> "\n"
    end
  end
end

defimpl Collectable, for: Factory.AgentOutput do
  def into(%{events: false}) do
    {[],
     fn
       chunks, {:cont, chunk} ->
         IO.binwrite(:stderr, chunk)
         [chunk | chunks]

       chunks, :done ->
         chunks |> Enum.reverse() |> IO.iodata_to_binary()

       _, :halt ->
         :ok
     end}
  end

  def into(%{events: true}) do
    {{"", ""},
     fn
       {buffer, answer}, {:cont, chunk} ->
         lines = String.split(buffer <> chunk, "\n")
         {complete, [pending]} = Enum.split(lines, -1)
         {pending, Enum.reduce(complete, answer, &Factory.AgentOutput.consume/2)}

       {"", answer}, :done ->
         answer

       {pending, answer}, :done ->
         Factory.AgentOutput.consume(pending, answer)

       _, :halt ->
         :ok
     end}
  end
end

defmodule Factory.CLI do
  def main(args) do
    {opts, rest, invalid} =
      OptionParser.parse(args,
        strict: [
          seed: :string,
          target: :string,
          attempts: :integer
        ]
      )

    cond do
      rest != [] or invalid != [] ->
        fail("invalid arguments")

      opts[:attempts] != nil and opts[:attempts] < 1 ->
        fail("attempts must be positive")

      is_nil(opts[:target]) ->
        fail("a target is required")

      is_nil(opts[:seed]) ->
        fail("no seed")

      not File.regular?(opts[:seed]) ->
        fail("no seed: #{opts[:seed]}")

      true ->
        target = Path.expand(opts[:target])
        seed = Path.expand(opts[:seed])
        line_folder = Path.expand("../../assembly-lines/careful", __DIR__)

        line =
          case Factory.AssemblyLine.load(line_folder) do
            {:ok, line} -> line
            {:error, message} -> fail(message)
          end

        machines = Map.new(Factory.AssemblyLine.machines(line), &{&1, machine(line, &1)})
        Enum.each(machines, fn {role, machine} -> check_login!(role, machine) end)

        config = %{
          machines: machines,
          attempts: opts[:attempts] || 3,
          line: line
        }

        File.mkdir_p!(target)

        case System.cmd("git", ["rev-parse", "--show-toplevel"],
               cd: target,
               stderr_to_stdout: true
             ) do
          {_, 0} -> :ok
          _ -> git!(target, ["init", "-q"])
        end

        run(target, seed, config)
    end
  end

  defp machine(line, role) do
    folder = Path.join([line.folder, "machines", role])
    settings = folder |> Path.join("machine.json") |> File.read!() |> :json.decode()
    harness = settings["harness"] || "pi"
    harness = if String.contains?(harness, "/"), do: Path.expand(harness, folder), else: harness
    %{folder: folder, harness: harness, settings: settings}
  end

  defp login_file(machine) do
    if Path.basename(machine.harness) == "claude", do: ".credentials.json", else: "auth.json"
  end

  defp api_key(machine) do
    case Path.basename(machine.harness) do
      "codex" ->
        "CODEX_API_KEY"

      "claude" ->
        "ANTHROPIC_API_KEY"

      _ ->
        machine.settings["api_key_env"] ||
          case machine.settings["provider"] || "anthropic" do
            "anthropic" -> "ANTHROPIC_API_KEY"
            "openai" -> "OPENAI_API_KEY"
            "google" -> "GEMINI_API_KEY"
            provider -> String.upcase(provider) <> "_API_KEY"
          end
    end
  end

  defp check_login!(role, machine) do
    unless File.regular?(Path.join(machine.folder, login_file(machine))) or
             System.get_env(api_key(machine)) not in [nil, ""] do
      fail(
        "#{role} cannot sign in: copy its login into #{machine.folder} or set #{api_key(machine)}"
      )
    end
  end

  defp harness_config(machine) do
    folder = machine.folder
    model = if machine.settings["model"], do: ["--model", machine.settings["model"]], else: []

    case Path.basename(machine.harness) do
      "claude" ->
        {["--print", "--setting-sources", "user"] ++ model, [{"CLAUDE_CONFIG_DIR", folder}]}

      "codex" ->
        {["exec", "--skip-git-repo-check", "-c", "project_doc_max_bytes=0"] ++
           model, [{"CODEX_HOME", folder}]}

      _ ->
        args = [
          "--print",
          "--no-session",
          "--no-context-files",
          "--append-system-prompt",
          Path.join(folder, "AGENTS.md")
        ]

        args =
          if Path.basename(machine.harness) == "pi", do: args ++ ["--mode", "json"], else: args

        provider =
          if machine.settings["provider"],
            do: ["--provider", machine.settings["provider"]],
            else: []

        {args ++ provider ++ model, [{"PI_CODING_AGENT_DIR", folder}]}
    end
  end

  defp run(target, seed, config) do
    state = %{attempts: 0, work_result: nil, findings: []}
    follow("start", %{}, target, seed, config, state)
  end

  defp follow(node, result, target, seed, config, state) do
    case Factory.AssemblyLine.next(config.line, node, result) do
      {:ok, "finish"} -> IO.puts("factory stopped")
      {:ok, next} -> visit(next, target, seed, config, state)
      {:error, message} -> fail(message)
    end
  end

  defp visit(role, target, seed, config, state) do
    if role == "doer" and state.attempts >= config.attempts, do: fail("a task hit its limit")

    # A return to the planner accepts the task's work. Commit before asking it
    # to record completion, then commit its plan update separately.
    if role == "planner" and state.work_result, do: commit(target)

    fields = Factory.AssemblyLine.fields(config.line, role)
    required = Enum.map_join(fields, ", ", &inspect/1)

    result_request =
      if required == "",
        do: "describing the work you did",
        else: "containing boolean fields #{required}"

    result_request =
      if role == "validator",
        do: result_request <> " and array \"findings\"",
        else: result_request

    answer =
      invoke(target, config.machines[role], role, """
      #{paths(target, seed)}
      #{instruction(role, target, state)}
      Finish with a single line of JSON #{result_request}.
      """)

    result = read_result!(answer, role)
    unless is_map(result), do: fail("could not read the #{role}'s result")

    if role == "validator" and not is_list(result["findings"]),
      do: fail("could not read the validator's result")

    state =
      case role do
        "planner" ->
          commit(target)
          %{state | attempts: 0, work_result: nil, findings: []}

        "doer" ->
          %{state | attempts: state.attempts + 1, work_result: answer}

        "validator" ->
          %{state | findings: result["findings"]}

        _ ->
          state
      end

    report(result)
    follow(role, result, target, seed, config, state)
  end

  defp instruction("planner", _target, %{work_result: nil}) do
    "Inspect the plan without changing it. If it is missing, write a short plan from the seed; do no product work."
  end

  defp instruction("planner", _target, state) do
    """
    The task's work has been committed. The accepted doer result was:
    #{state.work_result}
    Identify the corresponding task in the plan and mark it done.
    Do not merely report that an earlier task is already done.
    Then report whether every task is complete.
    """
  end

  defp instruction("doer", _target, state) do
    "Validator findings: #{IO.iodata_to_binary(:json.encode(state.findings))}"
  end

  defp instruction("validator", target, _state) do
    "Current task's work (changes since the last commit):\n#{work(target)}"
  end

  defp instruction(_role, _target, _state), do: ""

  defp paths(target, seed) do
    """
    Seed file: #{inspect(seed)}
    Plan file: #{inspect(Path.join(target, ".factory/plan.md"))}
    """
  end

  defp work(target) do
    tracked = git!(target, ["diff", "HEAD", "--", ".", ":(exclude).factory/**"])

    untracked =
      git!(target, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        ".",
        ":(exclude).factory/**"
      ])

    files = untracked |> String.split(<<0>>, trim: true)

    tracked <>
      Enum.map_join(files, "\n", fn file ->
        "\nNew file: #{file}\n" <> File.read!(Path.join(target, file))
      end)
  end

  defp commit(target) do
    git!(target, ["add", "-A", "--", "."])

    if git!(target, ["status", "--porcelain", "--", "."]) != "" do
      git!(target, ["commit", "--only", "-m", "Factory pass", "--", "."])
    end
  end

  defp report(result), do: IO.puts(IO.iodata_to_binary(:json.encode(result)))

  defp invoke(target, machine, role, prompt) do
    harness = machine.harness
    IO.puts(:stderr, "Calling #{role} (#{harness}) in #{target}...")
    prompt = "Machine: #{role}\n" <> prompt
    events = Path.basename(harness) == "pi"
    {agent_args, env} = harness_config(machine)

    {answer, status} =
      try do
        System.cmd(
          "sh",
          ["-c", "exec \"$@\" </dev/null", "factory-agent", harness] ++ agent_args ++ [prompt],
          cd: target,
          env: env,
          stderr_to_stdout: true,
          into: %Factory.AgentOutput{events: events}
        )
      rescue
        ErlangError -> fail("could not run the #{role}: #{harness}")
      end

    if status != 0, do: fail("could not run the #{role}: #{harness}\n#{answer}")
    answer
  end

  defp read_result!(answer, role) do
    result =
      answer
      |> String.split("\n", trim: true)
      |> Enum.reverse()
      |> Enum.find_value(fn line ->
        try do
          {:json, :json.decode(line)}
        rescue
          ArgumentError -> nil
          ErlangError -> nil
        end
      end)

    case result do
      {:json, value} -> value
      _ -> fail("could not read the #{role}'s result")
    end
  end

  defp git!(target, args) do
    case System.cmd("git", args, cd: target, stderr_to_stdout: true) do
      {output, 0} -> String.trim(output)
      {output, _} -> fail("git failed: #{output}")
    end
  end

  defp fail(message) do
    IO.puts(:stderr, message)
    System.halt(1)
  end
end
