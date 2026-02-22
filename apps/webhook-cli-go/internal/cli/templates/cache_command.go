package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
)

func newCacheCommand(deps Dependencies) *cobra.Command {
	cacheCmd := &cobra.Command{
		Use:   "cache",
		Short: "Manage template index cache",
		Args:  cobra.NoArgs,
	}
	cacheCmd.AddCommand(newCacheClearCommand(deps))
	return cacheCmd
}

func newCacheClearCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "clear",
		Short: "Clear the template index cache",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			cacheArgs, err := runtime.ResolveTemplatesCacheClearArgs(cmd)
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(cacheArgs.TemplatesDir)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			if err := service.ClearCache(ctx); err != nil {
				return mapTemplateCommandError(err, "")
			}
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Template cache cleared.")
			return nil
		},
	}
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
