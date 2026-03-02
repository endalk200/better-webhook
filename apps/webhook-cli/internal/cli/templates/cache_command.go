package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newCacheCommand(deps Dependencies) *cobra.Command {
	cacheCmd := &cobra.Command{
		Use:   "cache",
		Short: "Manage template index cache",
		RunE:  runTemplateCacheGroupCommand,
	}
	cacheCmd.AddCommand(newCacheClearCommand(deps))
	return cacheCmd
}

func runTemplateCacheGroupCommand(cmd *cobra.Command, args []string) error {
	if len(args) > 0 {
		return fmt.Errorf("unknown command %q for %q", args[0], cmd.CommandPath())
	}
	return cmd.Help()
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
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatSuccess("Template cache cleared."))
			return nil
		},
	}
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
