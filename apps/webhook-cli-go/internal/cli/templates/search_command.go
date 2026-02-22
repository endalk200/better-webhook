package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
	"github.com/spf13/cobra"
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
				_, _ = fmt.Fprintf(cmd.OutOrStdout(), "No templates found for %q.\n", searchArgs.Query)
				return nil
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Search results for %q:\n", searchArgs.Query)
			if len(results.Local) > 0 {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), "  Local:")
				for _, item := range results.Local {
					_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  - %s (%s)\n", item.ID, item.Metadata.Provider)
				}
			}
			if len(results.Remote) > 0 {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), "  Remote:")
				for _, item := range results.Remote {
					status := "remote"
					if item.IsDownloaded {
						status = "downloaded"
					}
					_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  - %s (%s, %s)\n", item.Metadata.ID, item.Metadata.Provider, status)
				}
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Found: %d template(s)\n", totalCount)
			return nil
		},
	}
	cmd.Flags().String("provider", "", "Filter by provider")
	cmd.Flags().Bool("refresh", false, "Force refresh the template index cache")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
