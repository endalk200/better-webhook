package captures

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newDeleteCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete <capture-id>",
		Aliases: []string{"rm"},
		Short:   "Delete a captured webhook",
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			deleteArgs, err := runtime.ResolveCapturesDeleteArgs(cmd, args[0])
			if err != nil {
				return err
			}

			capturesService, err := deps.ServiceFactory(deleteArgs.CapturesDir)
			if err != nil {
				return err
			}

			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}

			target, err := capturesService.Resolve(ctx, deleteArgs.Selector)
			if err != nil {
				return mapCaptureCommandError(err, deleteArgs.Selector)
			}

			if !deleteArgs.Force {
				if deps.Prompter == nil {
					return errors.New("captures prompter cannot be nil")
				}
				id := target.Capture.ID
				if len(id) > 8 {
					id = id[:8]
				}
				prompt := fmt.Sprintf(
					"Delete capture %s (%s %s)?",
					ui.SanitizeForTerminal(id),
					ui.SanitizeForTerminal(target.Capture.Method),
					ui.SanitizeForTerminal(target.Capture.Path),
				)
				confirmed, confirmErr := deps.Prompter.Confirm(prompt, cmd.InOrStdin(), cmd.ErrOrStderr())
				if confirmErr != nil {
					return confirmErr
				}
				if !confirmed {
					_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatCancelled())
					return nil
				}
			}

			deleted, err := capturesService.DeleteResolved(ctx, target)
			if err != nil {
				return mapCaptureCommandError(err, target.Capture.ID)
			}

			shortID := deleted.Capture.ID
			if len(shortID) > 8 {
				shortID = shortID[:8]
			}
			_, _ = fmt.Fprintln(
				cmd.OutOrStdout(),
				ui.FormatSuccess(fmt.Sprintf(
					"Deleted capture %s (%s)",
					ui.SanitizeForTerminal(shortID),
					ui.SanitizeForTerminal(deleted.File),
				)),
			)
			return nil
		},
	}

	cmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
	cmd.Flags().String("captures-dir", "", "Directory where captures are stored")
	return cmd
}
