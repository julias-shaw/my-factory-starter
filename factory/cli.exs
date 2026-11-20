Code.require_file("lib/factory/assembly_line.ex", __DIR__)
Code.require_file("lib/factory/cli.ex", __DIR__)
Factory.CLI.main(System.argv())
