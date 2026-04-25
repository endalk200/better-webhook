package cli

import (
	"fmt"
	"io"

	"github.com/spf13/cobra"
)

func NewRootCommand(build BuildInfo) *cobra.Command {
	cmd := &cobra.Command{
		Use:           "bw",
		Short:         "better-webhook command line interface",
		SilenceUsage:  true,
		SilenceErrors: true,
		Version:       fmt.Sprintf("bw version %s", build.Version),
		RunE: func(cmd *cobra.Command, _ []string) error {
			return cmd.Help()
		},
	}

	cmd.SetVersionTemplate("{{.Version}}\n")
	cmd.AddCommand(newVersionCommand(build))

	return cmd
}

func newVersionCommand(build BuildInfo) *cobra.Command {
	var verbose bool

	cmd := &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		RunE: func(cmd *cobra.Command, _ []string) error {
			out := cmd.OutOrStdout()
			return printVersion(out, build, verbose)
		},
	}

	cmd.Flags().BoolVar(&verbose, "verbose", false, "print release metadata")

	return cmd
}

func printVersion(out io.Writer, build BuildInfo, verbose bool) error {
	if !verbose {
		_, err := fmt.Fprintf(out, "bw version %s\n", build.Version)
		return err
	}

	_, err := fmt.Fprintf(
		out,
		"bw version %s\ncommit: %s\ndate: %s\nbuilt-by: %s\n",
		build.Version,
		build.Commit,
		build.Date,
		build.BuiltBy,
	)
	return err
}
