package captures

import (
	"github.com/spf13/cobra"

	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/captures"
	replaycmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/replay"
)

type ServiceFactory func(capturesDir string) (*appcaptures.Service, error)

type Dependencies struct {
	ServiceFactory     ServiceFactory
	ReplayDependencies replaycmd.Dependencies
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "captures",
		Aliases: []string{"c"},
		Short:   "Manage captured webhooks",
	}

	cmd.AddCommand(newListCommand(deps))
	cmd.AddCommand(newDeleteCommand(deps))
	cmd.AddCommand(replaycmd.NewCommand(deps.ReplayDependencies))

	return cmd
}
