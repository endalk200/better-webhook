package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/cli/internal/version"
)

// Execute runs the root command for the bw CLI.
func Execute() error {
	return newRootCommand().Execute()
}

func newRootCommand() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:           "bw",
		Short:         "Better Webhook CLI",
		Long:          "bw is the Better Webhook CLI release vehicle for local webhook tooling.",
		Version:       version.Version,
		SilenceErrors: true,
		SilenceUsage:  true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	rootCmd.SetVersionTemplate("{{printf \"%s\\n\" .Version}}")
	rootCmd.CompletionOptions.DisableDefaultCmd = true
	rootCmd.AddCommand(newVersionCommand())

	return rootCmd
}

func newVersionCommand() *cobra.Command {
	var jsonOutput bool

	cmd := &cobra.Command{
		Use:   "version",
		Short: "Print build information",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if !jsonOutput {
				_, err := fmt.Fprintln(cmd.OutOrStdout(), version.Version)
				return err
			}

			payload, err := json.MarshalIndent(version.Current(), "", "  ")
			if err != nil {
				return err
			}

			_, err = fmt.Fprintf(cmd.OutOrStdout(), "%s\n", payload)
			return err
		},
	}

	cmd.Flags().BoolVar(&jsonOutput, "json", false, "Print machine-readable version metadata")

	return cmd
}
