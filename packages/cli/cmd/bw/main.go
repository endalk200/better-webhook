package main

import (
	"os"

	"github.com/endalk200/better-webhook/packages/cli/internal/cli"
)

func main() {
	if err := cli.NewRootCommand(cli.BuildInfoFromLinker()).Execute(); err != nil {
		os.Exit(1)
	}
}
