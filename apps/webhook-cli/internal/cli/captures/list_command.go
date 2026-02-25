package captures

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/captures"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

func newListCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "List captured webhooks",
		RunE: func(cmd *cobra.Command, args []string) error {
			listArgs, err := runtime.ResolveCapturesListArgs(cmd)
			if err != nil {
				return err
			}

			capturesService, err := deps.ServiceFactory(listArgs.CapturesDir)
			if err != nil {
				return err
			}

			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			items, err := capturesService.List(ctx, appcaptures.ListRequest{
				Limit:    listArgs.Limit,
				Provider: listArgs.Provider,
			})
			if err != nil {
				return mapCaptureCommandError(err, "")
			}

			if len(items) == 0 {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatInfo("No captures found."))
				_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s %s\n", ui.Muted.Render("Storage:"), listArgs.CapturesDir)
				return nil
			}

			rows := make([][]string, 0, len(items))
			for _, item := range items {
				provider := item.Capture.Provider
				if provider == "" {
					provider = domain.ProviderUnknown
				}

				id := item.Capture.ID
				if len(id) > 8 {
					id = id[:8]
				}

				displayTime := item.Capture.Timestamp
				parsedTime, parseErr := time.Parse(time.RFC3339Nano, item.Capture.Timestamp)
				if parseErr == nil {
					displayTime = parsedTime.Local().Format(time.RFC3339)
				}

				rows = append(rows, []string{
					id,
					ui.FormatProvider(provider),
					ui.FormatMethod(item.Capture.Method),
					item.Capture.Path,
					fmt.Sprintf("%d B", item.Capture.ContentLength),
					displayTime,
				})
			}

			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.NewTable(
				[]string{"ID", "Provider", "Method", "Path", "Size", "Time"},
				rows,
			))
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Muted.Render(fmt.Sprintf("Showing %d capture(s) from %s", len(items), listArgs.CapturesDir)))
			return nil
		},
	}

	cmd.Flags().Int("limit", 20, "Maximum number of captures to show")
	cmd.Flags().String("provider", "", "Filter captures by provider")
	cmd.Flags().String("captures-dir", "", "Directory where captures are stored")

	return cmd
}

func mapCaptureCommandError(err error, selector string) error {
	if err == nil {
		return nil
	}
	if strings.TrimSpace(selector) == "" {
		selector = ""
	}
	if errors.Is(err, domain.ErrCaptureNotFound) {
		if selector == "" {
			return fmt.Errorf("capture not found")
		}
		return fmt.Errorf("capture not found: %s", selector)
	}
	if errors.Is(err, domain.ErrAmbiguousSelector) {
		if selector == "" {
			return fmt.Errorf("capture selector is ambiguous")
		}
		return fmt.Errorf("capture selector is ambiguous: %s", selector)
	}
	if errors.Is(err, domain.ErrInvalidSelector) {
		return fmt.Errorf("capture selector cannot be empty")
	}
	if errors.Is(err, domain.ErrInvalidLimit) {
		return fmt.Errorf("limit must be a positive integer")
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("operation cancelled")
	}
	return err
}
