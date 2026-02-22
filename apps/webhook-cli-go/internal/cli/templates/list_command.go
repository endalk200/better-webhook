package templates

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
	"github.com/spf13/cobra"
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
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), "No remote templates found.")
				return nil
			}

			_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Available templates:")
			grouped := groupRemoteTemplatesByProvider(templates)
			providers := sortedProviderKeys(grouped)
			for _, provider := range providers {
				_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  %s\n", strings.ToUpper(provider))
				for _, item := range grouped[provider] {
					status := "remote"
					if item.IsDownloaded {
						status = "downloaded"
					}
					_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  - %s [%s]\n", item.Metadata.ID, status)
				}
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Total: %d template(s)\n", len(templates))
			return nil
		},
	}

	cmd.Flags().String("provider", "", "Filter by provider")
	cmd.Flags().Bool("refresh", false, "Force refresh the template index cache")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}

func groupRemoteTemplatesByProvider(items []domain.RemoteTemplate) map[string][]domain.RemoteTemplate {
	grouped := make(map[string][]domain.RemoteTemplate)
	for _, item := range items {
		provider := item.Metadata.Provider
		if strings.TrimSpace(provider) == "" {
			provider = "unknown"
		}
		grouped[provider] = append(grouped[provider], item)
	}
	return grouped
}

func sortedProviderKeys[T any](grouped map[string][]T) []string {
	keys := make([]string, 0, len(grouped))
	for key := range grouped {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
