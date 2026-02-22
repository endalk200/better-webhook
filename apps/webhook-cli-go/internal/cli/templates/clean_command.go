package templates

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
			if len(items) == 0 {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), "No local templates to remove.")
				return nil
			}
			if !cleanArgs.Force {
				confirmed, confirmErr := promptTemplateCleanConfirm(cmd, fmt.Sprintf("Delete all %d template(s)? [y/N]: ", len(items)))
				if confirmErr != nil {
					return confirmErr
				}
				if !confirmed {
					_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Cancelled.")
					return nil
				}
			}
			deletedCount, err := service.CleanLocal(ctx)
			if err != nil {
				return mapTemplateCommandError(err, "")
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Removed %d template(s)\n", deletedCount)
			return nil
		},
	}

	cmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	return cmd
}

func promptTemplateCleanConfirm(cmd *cobra.Command, prompt string) (bool, error) {
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
