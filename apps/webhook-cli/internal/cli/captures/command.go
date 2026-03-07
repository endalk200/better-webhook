package captures

import (
	"fmt"

	"github.com/spf13/cobra"

	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/captures"
	replaycmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/replay"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

type ServiceFactory func(capturesDir string) (*appcaptures.Service, error)

type Dependencies struct {
	ServiceFactory     ServiceFactory
	ReplayDependencies replaycmd.Dependencies
	Prompter           ui.Prompter
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "captures",
		Aliases: []string{"c"},
		Short:   "Manage captured webhooks",
		Long: `Manage stored webhook captures.

Shared flags like --captures-dir apply to every captures subcommand.`,
		Example: `  better-webhook captures list
  better-webhook captures list --captures-dir ./tmp/captures
  better-webhook captures replay deadbeef --base-url http://localhost:3000
  better-webhook captures delete deadbeef --force`,
		RunE: runGroupCommand,
	}

	cmd.PersistentFlags().String("captures-dir", "", "Directory where captures are stored")
	cmd.AddCommand(newListCommand(deps))
	cmd.AddCommand(newDeleteCommand(deps))
	cmd.AddCommand(replaycmd.NewCommandWithOptions(
		deps.ReplayDependencies,
		replaycmd.CommandOptions{IncludeCapturesDirFlag: false},
	))

	return cmd
}

func runGroupCommand(cmd *cobra.Command, args []string) error {
	if len(args) > 0 {
		return fmt.Errorf("unknown command %q for %q", args[0], cmd.CommandPath())
	}
	return cmd.Help()
}
