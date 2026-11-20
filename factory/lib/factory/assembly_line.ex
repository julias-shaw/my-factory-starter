defmodule Factory.AssemblyLine do
  @moduledoc "Reads and validates the factory's directed assembly line."

  def load(folder) do
    with {:ok, source} <- File.read(Path.join(folder, "assembly-line.dot")),
         {:ok, edges} <- parse(source),
         :ok <- validate(edges, folder) do
      {:ok, %{folder: folder, edges: edges}}
    else
      {:error, reason} when is_atom(reason) -> {:error, "could not read assembly line: #{reason}"}
      error -> error
    end
  end

  # The line uses DOT directed edges, with optional quoted boolean-field labels.
  defp parse(source) do
    source = Regex.replace(~r{//[^\n]*|/\*.*?\*/}s, source, "")

    case Regex.run(~r/^\s*digraph\s*(?:[\w]+\s*)?\{(.*)\}\s*$/s, source) do
      [_, body] -> parse_edges(body, [])
      _ -> {:error, "invalid assembly line: expected a digraph"}
    end
  end

  defp parse_edges(body, edges) do
    body = String.trim_leading(body) |> String.trim_leading(";") |> String.trim_leading()

    if body == "" do
      {:ok, Enum.reverse(edges)}
    else
      case Regex.run(
             ~r/^([\w]+)\s*->\s*([\w]+)(?:\s*\[\s*label\s*=\s*"([^"]+)"\s*\])?/,
             body
           ) do
        [match, from, to | label] ->
          edge = %{from: from, to: to, label: List.first(label)}
          parse_edges(String.replace_prefix(body, match, ""), [edge | edges])

        _ ->
          {:error, "invalid assembly line edge: #{String.slice(body, 0, 80)}"}
      end
    end
  end

  defp validate(edges, folder) do
    nodes = Enum.flat_map(edges, &[&1.from, &1.to]) |> Enum.uniq()
    machines = nodes -- ["start", "finish"]

    missing =
      Enum.find(machines, &(not File.regular?(Path.join([folder, "machines", &1, "AGENTS.md"]))))

    unreachable = Enum.find(Enum.reverse(nodes), &(not reaches_finish?(&1, edges, MapSet.new())))

    cond do
      missing ->
        {:error, "no machine called #{missing}"}

      Enum.count(edges, &(&1.from == "start")) != 1 ->
        {:error, "start must have one outgoing edge"}

      Enum.any?(edges, &(&1.to == "start" or &1.from == "finish")) ->
        {:error, "invalid start or finish edge"}

      Enum.any?(edges, &(&1.to == "finish" and &1.from != "planner")) ->
        {:error, "only planner may lead to finish"}

      unreachable ->
        {:error, "finish cannot be reached from #{unreachable}"}

      true ->
        :ok
    end
  end

  defp reaches_finish?("finish", _edges, _seen), do: true

  defp reaches_finish?(node, edges, seen) do
    if MapSet.member?(seen, node) do
      false
    else
      Enum.any?(Enum.filter(edges, &(&1.from == node)), fn edge ->
        reaches_finish?(edge.to, edges, MapSet.put(seen, node))
      end)
    end
  end

  def machines(line) do
    Enum.flat_map(line.edges, &[&1.from, &1.to]) |> Enum.uniq() |> Kernel.--(["start", "finish"])
  end

  def fields(line, node) do
    outgoing(line, node)
    |> Enum.reject(&is_nil(&1.label))
    |> Enum.map(&String.replace_prefix(&1.label, "not ", ""))
    |> Enum.uniq()
  end

  def next(line, node, result) do
    missing = Enum.find(fields(line, node), &(not Map.has_key?(result, &1)))

    if missing do
      {:error, "result of #{node} has no field #{inspect(missing)}"}
    else
      edge = Enum.find(outgoing(line, node), &matches?(&1.label, result))
      if edge, do: {:ok, edge.to}, else: {:error, "no matching edge from #{node}"}
    end
  end

  defp outgoing(line, node), do: Enum.filter(line.edges, &(&1.from == node))
  defp matches?(nil, _result), do: true
  defp matches?("not " <> field, result), do: result[field] == false
  defp matches?(field, result), do: result[field] == true
end
