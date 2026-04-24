package main

import (
	"fmt"
	"os"

	"github.com/endalk200/better-webhook/apps/cli/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
