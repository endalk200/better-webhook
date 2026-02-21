package replay

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/replay"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
	"github.com/spf13/cobra"
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

			result, err := replayService.Replay(ctx, appreplay.ReplayRequest{
				Selector:        replayArgs.Selector,
				TargetURL:       replayArgs.TargetURL,
				BaseURL:         replayArgs.BaseURL,
				MethodOverride:  replayArgs.Method,
				HeaderOverrides: headerOverrides,
				Timeout:         replayArgs.Timeout,
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
				"Replayed capture %s [%s] %s %s -> %s\n",
				shortID,
				provider,
				result.Method,
				result.Capture.Capture.Path,
				result.TargetURL,
			)
			_, _ = fmt.Fprintf(
				cmd.OutOrStdout(),
				"Status: %d %s\n",
				result.Response.StatusCode,
				result.Response.StatusText,
			)
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Duration: %s\n", formatDuration(result.Response.Duration))

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
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("operation cancelled")
	}
	return err
}

func printVerboseOutput(cmd *cobra.Command, result appreplay.ReplayResult) {
	_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Request headers:")
	for _, header := range result.SentHeaders {
		_, _ = fmt.Fprintf(cmd.OutOrStdout(), "- %s: %s\n", header.Key, header.Value)
	}

	_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Response headers:")
	for _, header := range result.Response.Headers {
		_, _ = fmt.Fprintf(cmd.OutOrStdout(), "- %s: %s\n", header.Key, header.Value)
	}

	if len(result.Response.Body) == 0 {
		return
	}
	_, _ = fmt.Fprintln(cmd.OutOrStdout(), "Response body:")
	_, _ = fmt.Fprintln(cmd.OutOrStdout(), formatBodyPreview(result.Response.Body, result.Response.BodyTruncated))
}

func formatBodyPreview(body []byte, truncated bool) string {
	preview := string(body)
	var parsed interface{}
	if json.Unmarshal(body, &parsed) == nil {
		if formatted, err := json.MarshalIndent(parsed, "", "  "); err == nil {
			preview = string(formatted)
		}
	}
	if truncated {
		return preview + "\n... (truncated)"
	}
	return preview
}

func formatDuration(value time.Duration) string {
	if value < time.Millisecond {
		return value.String()
	}
	return value.Round(time.Millisecond).String()
}
