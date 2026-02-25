package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newSearchCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Search local and remote templates",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			searchArgs, err := runtime.ResolveTemplatesSearchArgs(cmd, args)
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(searchArgs.TemplatesDir)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			results, err := service.Search(ctx, searchArgs.Query, searchArgs.Provider, searchArgs.Refresh)
			if err != nil {
				return mapTemplateCommandError(err, "")
			}
			totalCount := len(results.Local) + len(results.Remote)
			if totalCount == 0 {
				_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s No templates found for %s.\n", ui.InfoIcon, ui.Bold.Render(searchArgs.Query))
				return nil
			}

			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Search results for %s:\n\n", ui.Bold.Render(searchArgs.Query))

			rows := make([][]string, 0, totalCount)
			for _, item := range results.Local {
				rows = append(rows, []string{
					item.ID,
					ui.FormatProvider(item.Metadata.Provider),
					ui.Success.Render("local"),
				})
			}
			for _, item := range results.Remote {
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
				[]string{"Template", "Provider", "Source"},
				rows,
			))
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Muted.Render(fmt.Sprintf("Found: %d template(s)", totalCount)))
			return nil
		},
	}
	cmd.Flags().String("provider", "", "Filter by provider")
	cmd.Flags().Bool("refresh", false, "Force refresh the template index cache")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
