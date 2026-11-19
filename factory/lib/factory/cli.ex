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
          harness: :string,
          doer_harness: :string,
          attempts: :integer,
          lens: :string,
          all: :boolean
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
        harness = resolve_harness(opts[:harness] || "pi")

        config = %{
          harness: harness,
          doer_harness: resolve_harness(opts[:doer_harness] || harness),
          attempts: opts[:attempts] || 3,
          lens: opts[:lens] || File.read!(Path.expand("../../VALIDATOR.md", __DIR__)),
          all: opts[:all] || false
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

  defp resolve_harness(harness) do
    if String.contains?(harness, "/"), do: Path.expand(harness), else: harness
  end

  defp run(target, seed, config) do
    had_plan = File.exists?(Path.join(target, ".factory/plan.md"))

    result =
      planner(
        target,
        seed,
        config,
        "Inspect the plan without changing it. If it is missing, write a short plan from the seed; do no product work."
      )

    complete = complete!(result)

    cond do
      complete or not had_plan ->
        commit(target)
        report(result)

        if config.all and not complete,
          do: run(target, seed, config),
          else: IO.puts("factory stopped")

      true ->
        work_result = attempt(target, seed, config, config.attempts, [])
        commit(target)

        result =
          planner(
            target,
            seed,
            config,
            """
            The task's work has been committed. The accepted doer result was:
            #{work_result}
            Identify the corresponding task in the plan and mark it done.
            Do not merely report that an earlier task is already done.
            Then report whether every task is complete.
            """
          )

        complete = complete!(result)
        commit(target)
        report(result)

        if config.all and not complete,
          do: run(target, seed, config),
          else: IO.puts("factory stopped")
    end
  end

  defp planner(target, seed, config, instruction) do
    answer =
      invoke(target, config.harness, "planner", """
      #{paths(target, seed)}
      You keep the plan. Do not implement product code.
      #{instruction}
      Finish with a single line of JSON containing the boolean field "complete".
      "complete" is true only when every task in the plan has been implemented,
      committed and marked done. Writing a new plan is not completion: report false.
      Any task without an explicit done marker means "complete": false, even if
      existing code looks sufficient. Do not perform unfinished tasks yourself;
      leave their implementation and verification to the doer and validator.
      """)

    read_result!(answer, "planner")
  end

  defp complete!(%{"complete" => complete}) when is_boolean(complete), do: complete
  defp complete!(_), do: fail("could not read the planner's result")

  defp attempt(_target, _seed, _config, 0, _findings), do: fail("pass hit its limit")

  defp attempt(target, seed, config, remaining, findings) do
    work_result =
      invoke(target, config.doer_harness, "doer", """
      #{paths(target, seed)}
      Read the plan and implement only its first unfinished task.
      Validator findings: #{IO.iodata_to_binary(:json.encode(findings))}
      Record each finding as a subtask of the task in progress and address it.
      Do not add top-level tasks or mark the task done; the planner does that after commit.
      Finish with a single line of JSON describing the work you did.
      """)

    answer =
      invoke(target, config.harness, "validator", """
      #{paths(target, seed)}
      Check only the current task's work supplied below, through this lens:
      #{config.lens}
      Read the plan to identify its first unfinished task. Judge the supplied work
      against that task, not the whole finished product. Do not reject missing
      features assigned to later tasks. Earlier completed tasks are out of scope.
      Report findings only. Do not change the work or the plan.
      Current task's work (changes since the last commit):
      #{work(target)}
      Finish with a single line of JSON containing boolean "satisfied" and array "findings".
      """)

    case read_result!(answer, "validator") do
      %{"satisfied" => true, "findings" => findings} when is_list(findings) ->
        work_result

      %{"satisfied" => false, "findings" => findings} when is_list(findings) ->
        attempt(target, seed, config, remaining - 1, findings)

      _ ->
        fail("could not read the validator's result")
    end
  end

  defp paths(target, seed) do
    """
    Seed file: #{inspect(seed)}
    Plan file: #{inspect(Path.join(target, ".factory/plan.md"))}
    Work only in this target. Do not stage or commit files; the factory handles Git.
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

  defp invoke(target, harness, role, prompt) do
    IO.puts(:stderr, "Calling #{role} (#{harness}) in #{target}...")
    prompt = "Machine: #{role}\n" <> prompt
    events = Path.basename(harness) == "pi"
    agent_args = ["--print", "--no-session"] ++ if(events, do: ["--mode", "json"], else: [])

    {answer, status} =
      try do
        System.cmd(
          "sh",
          ["-c", "exec \"$@\" </dev/null", "factory-agent", harness] ++ agent_args ++ [prompt],
          cd: target,
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
