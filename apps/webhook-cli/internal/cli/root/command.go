package root

import (
	"github.com/spf13/cobra"

	capturecmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/capture"
	capturescmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/captures"
	initcmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/init"
	replaycmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/replay"
	templatescmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/templates"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
)

type Dependencies struct {
	Version              string
	ConfigLoader         runtime.Loader
	InitDependencies     initcmd.Dependencies
	CaptureDependencies  capturecmd.Dependencies
	CapturesDependencies capturescmd.Dependencies
	TemplateDependencies templatescmd.Dependencies
}

func NewCommand(deps Dependencies) *cobra.Command {
	initCommand := initcmd.NewCommand(deps.InitDependencies)
	replayCommand := replaycmd.NewCommand(deps.CapturesDependencies.ReplayDependencies)

	rootCmd := &cobra.Command{
		Use:   "better-webhook",
		Short: "Capture, replay, and test webhooks locally",
		Long: `A local CLI for capturing webhook requests with high-fidelity storage.

Start capturing right away:
  better-webhook capture --port 3001

Optional: write a documented config file first:
  better-webhook init`,
		Example: `  better-webhook init
  better-webhook capture --port 3001
  better-webhook captures list
  better-webhook replay <capture-id> --base-url http://localhost:3000
  better-webhook templates run github-push http://localhost:3000/api/webhooks/github`,
		Version:       deps.Version,
		SilenceErrors: true,
		SilenceUsage:  true,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if shouldSkipConfigInitialization(cmd, initCommand) {
				return nil
			}
			return runtime.InitializeConfig(cmd, deps.ConfigLoader)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	rootCmd.PersistentFlags().String("config", "", "Path to config TOML file")
	rootCmd.SetVersionTemplate("{{printf \"%s\\n\" .Version}}")
	rootCmd.AddCommand(initCommand)
	rootCmd.AddCommand(capturecmd.NewCommand(deps.CaptureDependencies))
	rootCmd.AddCommand(replayCommand)
	rootCmd.AddCommand(capturescmd.NewCommand(deps.CapturesDependencies))
	rootCmd.AddCommand(templatescmd.NewCommand(deps.TemplateDependencies))

	return rootCmd
}

func shouldSkipConfigInitialization(cmd, initCommand *cobra.Command) bool {
	if cmd == nil || initCommand == nil {
		return false
	}
	for current := cmd; current != nil; current = current.Parent() {
		if current == initCommand {
			return true
		}
	}
	return false
}
