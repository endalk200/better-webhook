package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
	"github.com/spf13/cobra"
)

func newDownloadCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "download [template-id]",
		Aliases: []string{"get"},
		Short:   "Download template(s) to local storage",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) > 1 {
				return fmt.Errorf("too many arguments: expected [template-id], received %d", len(args))
			}
			all, err := cmd.Flags().GetBool("all")
			if err != nil {
				return err
			}
			if all && len(args) == 1 {
				return fmt.Errorf("cannot provide template-id when --all is set")
			}
			if !all && len(args) != 1 {
				return fmt.Errorf("must provide --all or a single template-id")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			downloadArgs, err := runtime.ResolveTemplatesDownloadArgs(cmd, args)
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(downloadArgs.TemplatesDir)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}

			if downloadArgs.All {
				result, err := service.DownloadAll(ctx, downloadArgs.Refresh)
				if err != nil {
					return mapTemplateCommandError(err, "")
				}
				if result.Total > 0 && result.Skipped == result.Total {
					_, _ = fmt.Fprintln(cmd.OutOrStdout(), "All templates already downloaded.")
					return nil
				}
				_, _ = fmt.Fprintf(
					cmd.OutOrStdout(),
					"Template download complete: downloaded=%d skipped=%d failed=%d\n",
					result.Downloaded,
					result.Skipped,
					result.Failed,
				)
				for _, failedID := range result.FailedIDs {
					_, _ = fmt.Fprintf(cmd.OutOrStdout(), "- failed: %s\n", failedID)
				}
				return nil
			}

			localTemplate, err := service.Download(ctx, downloadArgs.TemplateID, downloadArgs.Refresh)
			if err != nil {
				return mapTemplateCommandError(err, downloadArgs.TemplateID)
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Downloaded template %s\n", localTemplate.ID)
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Saved to: %s\n", localTemplate.FilePath)
			return nil
		},
	}

	cmd.Flags().Bool("all", false, "Download all templates")
	cmd.Flags().Bool("refresh", false, "Force refresh the template index cache")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
