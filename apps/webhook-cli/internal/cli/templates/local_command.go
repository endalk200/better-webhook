package templates

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
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
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), "No local templates found.")
				return nil
			}
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Local templates:")
			grouped := groupLocalTemplatesByProvider(items)
			providers := slices.Sorted(maps.Keys(grouped))
			for _, provider := range providers {
				_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  %s\n", strings.ToUpper(provider))
				for _, item := range grouped[provider] {
					_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  - %s (%s)\n", item.ID, item.Metadata.Event)
				}
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Total: %d template(s)\n", len(items))
			return nil
		},
	}
	cmd.Flags().String("provider", "", "Filter by provider")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}

func groupLocalTemplatesByProvider(items []domain.LocalTemplate) map[string][]domain.LocalTemplate {
	grouped := make(map[string][]domain.LocalTemplate)
	for _, item := range items {
		provider := strings.TrimSpace(item.Metadata.Provider)
		if provider == "" {
			provider = "unknown"
		}
		grouped[provider] = append(grouped[provider], item)
	}
	return grouped
}
