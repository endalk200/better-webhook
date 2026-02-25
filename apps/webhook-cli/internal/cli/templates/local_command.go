package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newLocalCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "local",
		Short: "List downloaded local templates",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			localArgs, err := runtime.ResolveTemplatesLocalArgs(cmd)
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(localArgs.TemplatesDir)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			items, err := service.ListLocal(ctx, localArgs.Provider)
			if err != nil {
				return mapTemplateCommandError(err, "")
			}
			if len(items) == 0 {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatInfo("No local templates found."))
				return nil
			}

			rows := make([][]string, 0, len(items))
			for _, item := range items {
				rows = append(rows, []string{
					item.ID,
					ui.FormatProvider(item.Metadata.Provider),
					item.Metadata.Event,
				})
			}

			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.NewTable(
				[]string{"Template", "Provider", "Event"},
				rows,
			))
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Muted.Render(fmt.Sprintf("Total: %d template(s)", len(items))))
			return nil
		},
	}
	cmd.Flags().String("provider", "", "Filter by provider")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
