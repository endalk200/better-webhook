package templates

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newCleanCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "clean",
		Aliases: []string{"remove-all"},
		Short:   "Remove all downloaded local templates",
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			cleanArgs, err := runtime.ResolveTemplatesCleanArgs(cmd)
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(cleanArgs.TemplatesDir)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			items, err := service.ListLocal(ctx, "")
			if err != nil {
				return mapTemplateCommandError(err, "")
			}
			prompter := deps.Prompter
			if prompter == nil {
				prompter = ui.DefaultPrompter
			}
			if len(items) == 0 {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatInfo("No local templates to remove."))
				return nil
			}
			if !cleanArgs.Force {
				prompt := fmt.Sprintf("Delete all %d template(s)?", len(items))
				confirmed, confirmErr := prompter.Confirm(prompt, cmd.InOrStdin(), cmd.ErrOrStderr())
				if confirmErr != nil {
					return confirmErr
				}
				if !confirmed {
					_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatCancelled())
					return nil
				}
			}
			deletedCount, err := service.CleanLocal(ctx)
			if err != nil {
				return mapTemplateCommandError(err, "")
			}
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatSuccess(fmt.Sprintf("Removed %d template(s)", deletedCount)))
			return nil
		},
	}

	cmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}
