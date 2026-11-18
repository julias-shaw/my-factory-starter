defmodule Factory.MixProject do
  use Mix.Project

  def project do
    [
      app: :factory,
      version: "0.1.0",
      elixir: "~> 1.18",
      deps: [{:cucumber, "~> 1.1", only: :test}]
    ]
  end

  def application, do: [extra_applications: [:logger]]
end
