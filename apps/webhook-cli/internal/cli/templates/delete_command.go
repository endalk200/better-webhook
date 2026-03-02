package templates

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newDeleteCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete <template-id>",
		Aliases: []string{"rm"},
		Short:   "Delete a downloaded local template",
		Args:    validateTemplateDeleteCommandArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			deleteArgs, err := runtime.ResolveTemplatesDeleteArgs(cmd, args[0])
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(deleteArgs.TemplatesDir)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}

			if !deleteArgs.Force {
				if deps.Prompter == nil {
					return errors.New("templates prompter cannot be nil")
				}
				prompt := fmt.Sprintf("Delete template %s?", deleteArgs.TemplateID)
				confirmed, confirmErr := deps.Prompter.Confirm(prompt, cmd.InOrStdin(), cmd.ErrOrStderr())
				if confirmErr != nil {
					return confirmErr
				}
				if !confirmed {
					_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatCancelled())
					return nil
				}
			}

			deleted, err := service.DeleteLocal(ctx, deleteArgs.TemplateID)
			if err != nil {
				return mapTemplateCommandError(err, deleteArgs.TemplateID)
			}
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatSuccess(fmt.Sprintf("Deleted template %s", deleted.ID)))
			return nil
		},
	}

	cmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}

func validateTemplateDeleteCommandArgs(cmd *cobra.Command, args []string) error {
	if len(args) == 0 {
		return errors.New("template id is required. List local templates with `better-webhook templates list --local`")
	}
	if len(args) > 1 {
		return fmt.Errorf("too many arguments: expected <template-id>, received %d", len(args))
	}
	if strings.TrimSpace(args[0]) == "" {
		return errors.New("template id cannot be empty")
	}
	return nil
}
