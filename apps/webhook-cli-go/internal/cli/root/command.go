package root

import (
	"github.com/spf13/cobra"

	capturecmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/capture"
	capturescmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/captures"
	replaycmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/replay"
	templatescmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/templates"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
)

type Dependencies struct {
	Version              string
	ConfigLoader         runtime.Loader
	CaptureDependencies  capturecmd.Dependencies
	CapturesDependencies capturescmd.Dependencies
	ReplayDependencies   replaycmd.Dependencies
	TemplateDependencies templatescmd.Dependencies
}

func NewCommand(deps Dependencies) *cobra.Command {
	rootCmd := &cobra.Command{
		Use:     "better-webhook",
		Short:   "Capture and inspect webhook requests locally",
		Long:    "A local CLI for capturing webhook requests with high-fidelity storage.",
		Version: deps.Version,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			return runtime.InitializeConfig(cmd, deps.ConfigLoader)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	rootCmd.PersistentFlags().String("config", "", "Path to config TOML file")
	rootCmd.SetVersionTemplate("{{printf \"%s\\n\" .Version}}")
	rootCmd.AddCommand(capturecmd.NewCommand(deps.CaptureDependencies))
	rootCmd.AddCommand(capturescmd.NewCommand(deps.CapturesDependencies))
	rootCmd.AddCommand(replaycmd.NewCommand(deps.ReplayDependencies))
	rootCmd.AddCommand(templatescmd.NewCommand(deps.TemplateDependencies))

	return rootCmd
}
