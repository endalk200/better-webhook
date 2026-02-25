package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newListCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "List available remote templates",
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			listArgs, err := runtime.ResolveTemplatesListArgs(cmd)
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(listArgs.TemplatesDir)
			if err != nil {
				return err
			}

			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			templates, err := service.ListRemote(ctx, listArgs.Provider, listArgs.Refresh)
			if err != nil {
				return mapTemplateCommandError(err, "")
			}
			if len(templates) == 0 {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatInfo("No remote templates found."))
				return nil
			}

			rows := make([][]string, 0, len(templates))
			for _, item := range templates {
				status := ui.Muted.Render("remote")
				if item.IsDownloaded {
					status = ui.Success.Render("downloaded")
				}
				rows = append(rows, []string{
					item.Metadata.ID,
					ui.FormatProvider(item.Metadata.Provider),
					status,
				})
			}

			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.NewTable(
				[]string{"Template", "Provider", "Status"},
				rows,
			))
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Muted.Render(fmt.Sprintf("Total: %d template(s)", len(templates))))
			return nil
		},
	}

	cmd.Flags().String("provider", "", "Filter by provider")
	cmd.Flags().Bool("refresh", false, "Force refresh the template index cache")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
