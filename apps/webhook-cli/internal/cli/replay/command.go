package replay

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/replay"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

type ServiceFactory func(capturesDir string) (*appreplay.Service, error)

type Dependencies struct {
	ServiceFactory ServiceFactory
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "replay <capture-id> [target-url]",
		Short: "Replay a captured webhook to a target URL",
		Args:  validateReplayCommandArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("replay service factory cannot be nil")
			}

			replayArgs, err := runtime.ResolveReplayArgs(cmd, args)
			if err != nil {
				return err
			}

			replayService, err := deps.ServiceFactory(replayArgs.CapturesDir)
			if err != nil {
				return err
			}

			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			headerOverrides := make([]domain.HeaderEntry, 0, len(replayArgs.HeaderOverrides))
			for _, override := range replayArgs.HeaderOverrides {
				headerOverrides = append(headerOverrides, domain.HeaderEntry{
					Key:   override.Key,
					Value: override.Value,
				})
			}

			var result appreplay.ReplayResult
			err = ui.WithSpinner("Replaying capture...", cmd.OutOrStdout(), func() error {
				var replayErr error
				result, replayErr = replayService.Replay(ctx, appreplay.ReplayRequest{
					Selector:        replayArgs.Selector,
					TargetURL:       replayArgs.TargetURL,
					BaseURL:         replayArgs.BaseURL,
					MethodOverride:  replayArgs.Method,
					HeaderOverrides: headerOverrides,
					Timeout:         replayArgs.Timeout,
				})
				return replayErr
			})
			if err != nil {
				return mapReplayCommandError(err, replayArgs.Selector)
			}

			shortID := result.Capture.Capture.ID
			if len(shortID) > 8 {
				shortID = shortID[:8]
			}
			provider := result.Capture.Capture.Provider
			if provider == "" {
				provider = domain.ProviderUnknown
			}

			_, _ = fmt.Fprintf(
				cmd.OutOrStdout(),
				"%s %s %s %s %s %s\n",
				ui.FormatSuccess("Replayed"),
				ui.Muted.Render(shortID),
				ui.FormatProvider(provider),
				ui.FormatMethod(result.Method),
				ui.Muted.Render("->"),
				result.TargetURL,
			)
			_, _ = fmt.Fprintf(
				cmd.OutOrStdout(),
				"  %s  %s\n",
				ui.FormatStatusCode(result.Response.StatusCode, result.Response.StatusText),
				ui.FormatDuration(result.Response.Duration),
			)

			if replayArgs.Verbose {
				printVerboseOutput(cmd, result)
			}

			return nil
		},
	}

	cmd.Flags().String("captures-dir", "", "Directory where captures are stored")
	cmd.Flags().String("base-url", runtime.DefaultReplayBaseURL, "Base URL used with the captured request URI when target-url is omitted")
	cmd.Flags().String("method", "", "Override HTTP method")
	cmd.Flags().StringArrayP("header", "H", nil, "Add or override header (format: key:value)")
	cmd.Flags().Duration("timeout", runtime.DefaultReplayTimeout, "HTTP request timeout")
	cmd.Flags().BoolP("verbose", "v", false, "Show detailed request/response information")

	return cmd
}

func validateReplayCommandArgs(cmd *cobra.Command, args []string) error {
	if len(args) == 0 {
		return errors.New("capture selector is required. List captures with `better-webhook captures list` and pass a capture ID")
	}
	if len(args) > 2 {
		return fmt.Errorf("too many arguments: expected <capture-id> [target-url], received %d", len(args))
	}
	selector := strings.TrimSpace(args[0])
	if selector == "" {
		return errors.New("capture selector cannot be empty")
	}
	if len(args) == 2 && strings.TrimSpace(args[1]) == "" {
		return errors.New("target URL cannot be empty when provided")
	}
	return nil
}

func mapReplayCommandError(err error, selector string) error {
	if err == nil {
		return nil
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
	if errors.Is(err, appreplay.ErrInvalidTargetURL) {
		return fmt.Errorf("target URL is invalid")
	}
	if errors.Is(err, appreplay.ErrInvalidBaseURL) {
		return fmt.Errorf("base URL is invalid")
	}
	if errors.Is(err, appreplay.ErrInvalidMethod) {
		return fmt.Errorf("method contains invalid characters")
	}
	if errors.Is(err, appreplay.ErrInvalidBody) {
		return fmt.Errorf("captured payload is invalid and cannot be replayed")
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("operation timed out")
	}
	if errors.Is(err, context.Canceled) {
		return fmt.Errorf("operation cancelled")
	}
	return err
}

func printVerboseOutput(cmd *cobra.Command, result appreplay.ReplayResult) {
	if len(result.SentHeaders) > 0 {
		_, _ = fmt.Fprintln(cmd.OutOrStdout())
		_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Bold.Render("Request headers"))
		pairs := make([][]string, 0, len(result.SentHeaders))
		for _, header := range result.SentHeaders {
			pairs = append(pairs, []string{header.Key, header.Value})
		}
		_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.NewKeyValueTable(pairs))
	}

	if len(result.Response.Headers) > 0 {
		_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Bold.Render("Response headers"))
		pairs := make([][]string, 0, len(result.Response.Headers))
		for _, header := range result.Response.Headers {
			pairs = append(pairs, []string{header.Key, header.Value})
		}
		_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.NewKeyValueTable(pairs))
	}

	if len(result.Response.Body) == 0 {
		return
	}
	_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Bold.Render("Response body"))
	_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatBodyPreview(result.Response.Body, result.Response.BodyTruncated))
}
