package captures

import (
	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/captures"
	"github.com/spf13/cobra"
)

type ServiceFactory func(capturesDir string) (*appcaptures.Service, error)

type Dependencies struct {
	ServiceFactory ServiceFactory
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "captures",
		Aliases: []string{"c"},
		Short:   "Manage captured webhooks",
	}

	cmd.AddCommand(newListCommand(deps))
	cmd.AddCommand(newDeleteCommand(deps))

	return cmd
}
