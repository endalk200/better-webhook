package captures

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/captures"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
	"github.com/spf13/cobra"
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
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), "No captures found.")
				_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Storage: %s\n", listArgs.CapturesDir)
				return nil
			}

			_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Captured webhooks:")
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

				_, _ = fmt.Fprintf(
					cmd.OutOrStdout(),
					"- %s [%s] %s %s (%d bytes) %s\n",
					id,
					provider,
					item.Capture.Method,
					item.Capture.Path,
					item.Capture.ContentLength,
					displayTime,
				)
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Showing %d capture(s) from %s\n", len(items), listArgs.CapturesDir)
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
