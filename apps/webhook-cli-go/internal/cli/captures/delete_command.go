package captures

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
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
				id := target.Capture.ID
				if len(id) > 8 {
					id = id[:8]
				}
				prompt := fmt.Sprintf("Delete capture %s (%s %s)? [y/N]: ", id, target.Capture.Method, target.Capture.Path)
				confirmed, confirmErr := promptConfirm(cmd, prompt)
				if confirmErr != nil {
					return confirmErr
				}
				if !confirmed {
					_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Cancelled.")
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
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Deleted capture %s (%s)\n", shortID, deleted.File)
			return nil
		},
	}

	cmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
	cmd.Flags().String("captures-dir", "", "Directory where captures are stored")
	return cmd
}

func promptConfirm(cmd *cobra.Command, prompt string) (bool, error) {
	_, _ = fmt.Fprint(cmd.OutOrStdout(), prompt)
	reader := bufio.NewReader(cmd.InOrStdin())
	line, err := reader.ReadString('\n')
	if err != nil {
		if errors.Is(err, io.EOF) {
			normalized := strings.TrimSpace(strings.ToLower(line))
			if normalized == "" {
				return false, nil
			}
			return normalized == "y" || normalized == "yes", nil
		}
		return false, err
	}
	normalized := strings.TrimSpace(strings.ToLower(line))
	return normalized == "y" || normalized == "yes", nil
}
