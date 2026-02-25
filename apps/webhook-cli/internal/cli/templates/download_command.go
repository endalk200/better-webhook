package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
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
				var result apptemplates.DownloadAllResult
				err = ui.WithSpinner("Downloading all templates...", cmd.OutOrStdout(), func() error {
					var dlErr error
					result, dlErr = service.DownloadAll(ctx, downloadArgs.Refresh)
					return dlErr
				})
				if err != nil {
					return mapTemplateCommandError(err, "")
				}
				if result.Total > 0 && result.Skipped == result.Total {
					_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatInfo("All templates already downloaded."))
					return nil
				}

				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatSuccess("Download complete"))
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.NewKeyValueTable([][]string{
					{"Downloaded", ui.Success.Render(fmt.Sprintf("%d", result.Downloaded))},
					{"Skipped", ui.Muted.Render(fmt.Sprintf("%d", result.Skipped))},
					{"Failed", formatFailedCount(result.Failed)},
				}))
				for _, failedID := range result.FailedIDs {
					_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  %s %s\n", ui.ErrorIcon, failedID)
				}
				return nil
			}

			var localTemplate domain.LocalTemplate
			err = ui.WithSpinner("Downloading template...", cmd.OutOrStdout(), func() error {
				var dlErr error
				localTemplate, dlErr = service.Download(ctx, downloadArgs.TemplateID, downloadArgs.Refresh)
				return dlErr
			})
			if err != nil {
				return mapTemplateCommandError(err, downloadArgs.TemplateID)
			}
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatSuccess(fmt.Sprintf("Downloaded template %s", localTemplate.ID)))
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "  %s %s\n", ui.Muted.Render("Saved to:"), localTemplate.FilePath)
			return nil
		},
	}

	cmd.Flags().Bool("all", false, "Download all templates")
	cmd.Flags().Bool("refresh", false, "Force refresh the template index cache")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}

func formatFailedCount(count int) string {
	if count > 0 {
		return ui.Error.Render(fmt.Sprintf("%d", count))
	}
	return ui.Muted.Render("0")
}
