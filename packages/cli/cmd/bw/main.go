package main

import (
	"fmt"
	"os"

	"github.com/endalk200/better-webhook/packages/cli/internal/cli"
)

func main() {
	if err := cli.NewRootCommand(cli.BuildInfoFromLinker()).Execute(); err != nil {
		if cli.ArgsRequestJSON(os.Args[1:]) {
			_ = cli.PrintMachineError(os.Stdout, err)
			os.Exit(1)
		}
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}
