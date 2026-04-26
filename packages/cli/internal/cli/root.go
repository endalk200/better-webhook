package cli

import (
	"encoding/json"
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
	var format string

	cmd := &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		RunE: func(cmd *cobra.Command, _ []string) error {
			out := cmd.OutOrStdout()
			return printVersion(out, build, versionOptions{
				format:  format,
				verbose: verbose,
			})
		},
	}

	cmd.Flags().StringVar(&format, "format", "human", "output format: human or json")
	cmd.Flags().BoolVar(&verbose, "verbose", false, "print release metadata")

	return cmd
}

type versionOptions struct {
	format  string
	verbose bool
}

type versionOutput struct {
	SchemaVersion string `json:"schemaVersion"`
	Command       string `json:"command"`
	Version       string `json:"version"`
	Commit        string `json:"commit"`
	Date          string `json:"date"`
	BuiltBy       string `json:"builtBy"`
}

func printVersion(out io.Writer, build BuildInfo, opts versionOptions) error {
	switch opts.format {
	case "human":
		return printHumanVersion(out, build, opts.verbose)
	case "json":
		if opts.verbose {
			return fmt.Errorf("unsupported flag combination: --verbose only applies to human format")
		}
		return printJSONVersion(out, build)
	default:
		return fmt.Errorf("unsupported output format %q: expected human or json", opts.format)
	}
}

func printHumanVersion(out io.Writer, build BuildInfo, verbose bool) error {
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

func printJSONVersion(out io.Writer, build BuildInfo) error {
	encoder := json.NewEncoder(out)
	return encoder.Encode(versionOutput{
		SchemaVersion: "1",
		Command:       "version",
		Version:       build.Version,
		Commit:        build.Commit,
		Date:          build.Date,
		BuiltBy:       build.BuiltBy,
	})
}
