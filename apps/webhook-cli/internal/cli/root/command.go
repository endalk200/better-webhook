package root

import (
	"github.com/spf13/cobra"

	capturecmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/capture"
	capturescmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/captures"
	initcmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/init"
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
	rootCmd := &cobra.Command{
		Use:     "better-webhook",
		Short:   "Capture and inspect webhook requests locally",
		Long:    "A local CLI for capturing webhook requests with high-fidelity storage.",
		Version: deps.Version,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if shouldSkipConfigInitialization(cmd) {
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
	rootCmd.AddCommand(initcmd.NewCommand(deps.InitDependencies))
	rootCmd.AddCommand(capturecmd.NewCommand(deps.CaptureDependencies))
	rootCmd.AddCommand(capturescmd.NewCommand(deps.CapturesDependencies))
	rootCmd.AddCommand(templatescmd.NewCommand(deps.TemplateDependencies))

	return rootCmd
}

func shouldSkipConfigInitialization(cmd *cobra.Command) bool {
	return cmd != nil && cmd.Name() == "init"
}
