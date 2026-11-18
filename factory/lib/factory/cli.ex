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
        strict: [seed: :string, target: :string, harness: :string, all: :boolean]
      )

    cond do
      rest != [] or invalid != [] ->
        fail("invalid arguments")

      is_nil(opts[:target]) ->
        fail("a target is required")

      is_nil(opts[:seed]) ->
        fail("no seed")

      not File.regular?(opts[:seed]) ->
        fail("no seed: #{opts[:seed]}")

      true ->
        target = Path.expand(opts[:target])
        seed = Path.expand(opts[:seed])
        harness = opts[:harness] || "pi"
        harness = if String.contains?(harness, "/"), do: Path.expand(harness), else: harness
        File.mkdir_p!(target)

        case System.cmd("git", ["rev-parse", "--show-toplevel"],
               cd: target,
               stderr_to_stdout: true
             ) do
          {_, 0} -> :ok
          _ -> git!(target, ["init", "-q"])
        end

        run(target, seed, harness, opts[:all] || false)
    end
  end

  defp run(target, seed, harness, all) do
    prompt = """
    Build the software described by the seed file at #{inspect(seed)}.
    Keep the plan at #{inspect(Path.join(target, ".factory/plan.md"))}.
    If there is no plan, read the seed and write a short plan; do no product work yet.
    Otherwise read the plan, implement only its first unfinished task in this target,
    and mark that task done in the plan. If nothing remains, report completion.
    Do not stage or commit files; the factory handles Git. Work only in this target.
    Finish with a single line of JSON containing the boolean field "complete"
    (true only when the plan is complete), and optionally "task" describing the task.
    """

    IO.puts(:stderr, "Calling #{harness} in #{target}...")

    events = Path.basename(harness) == "pi"
    agent_args = ["--print", "--no-session"] ++ if(events, do: ["--mode", "json"], else: [])

    {answer, status} =
      try do
        # Pi reads piped stdin before starting; give it EOF immediately.
        System.cmd(
          "sh",
          ["-c", "exec \"$@\" </dev/null", "factory-agent", harness] ++ agent_args ++ [prompt],
          cd: target,
          stderr_to_stdout: true,
          into: %Factory.AgentOutput{events: events}
        )
      rescue
        ErlangError -> fail("could not run the agent: #{harness}")
      end

    if status != 0, do: fail("could not run the agent: #{harness}\n#{answer}")

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

    complete =
      case result do
        {:json, %{"complete" => complete}} when is_boolean(complete) -> complete
        _ -> fail("could not read the agent's result")
      end

    git!(target, ["add", "-A", "--", "."])

    if git!(target, ["status", "--porcelain", "--", "."]) != "" do
      git!(target, ["commit", "--only", "-m", "Factory pass", "--", "."])
    end

    {:json, value} = result
    IO.puts(IO.iodata_to_binary(:json.encode(value)))

    if all and not complete do
      run(target, seed, harness, all)
    else
      IO.puts("factory stopped")
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
