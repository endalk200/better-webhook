package main

import (
	"fmt"
	"os"

	"github.com/endalk200/better-webhook/packages/cli/internal/cli"
)

func main() {
	if err := cli.NewRootCommand(cli.BuildInfoFromLinker()).Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}
