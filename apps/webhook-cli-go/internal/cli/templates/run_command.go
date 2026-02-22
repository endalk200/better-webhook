package templates

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
)

func newRunCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "run <template-id> [target-url]",
		Short: "Run a downloaded template against a target URL",
		Args:  validateRunCommandArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ServiceFactory == nil {
				return errors.New("templates service factory cannot be nil")
			}
			runArgs, err := runtime.ResolveTemplatesRunArgs(cmd, args)
			if err != nil {
				return err
			}
			service, err := deps.ServiceFactory(runArgs.TemplatesDir)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			if ctx == nil {
				ctx = context.Background()
			}
			headerOverrides := make([]domain.HeaderEntry, 0, len(runArgs.HeaderOverrides))
			for _, override := range runArgs.HeaderOverrides {
				headerOverrides = append(headerOverrides, domain.HeaderEntry{
					Key:   override.Key,
					Value: override.Value,
				})
			}
			result, err := service.Run(ctx, apptemplates.RunRequest{
				TemplateID:           runArgs.TemplateID,
				TargetURL:            runArgs.TargetURL,
				Secret:               runArgs.Secret,
				AllowEnvPlaceholders: runArgs.AllowEnvPlaceholders,
				HeaderOverrides:      headerOverrides,
				Timeout:              runArgs.Timeout,
			})
			if err != nil {
				return mapTemplateCommandError(err, runArgs.TemplateID)
			}

			_, _ = fmt.Fprintf(
				cmd.OutOrStdout(),
				"Executed template %s [%s] %s -> %s\n",
				result.TemplateID,
				result.Provider,
				result.Method,
				result.TargetURL,
			)
			_, _ = fmt.Fprintf(
				cmd.OutOrStdout(),
				"Status: %d %s\n",
				result.Response.StatusCode,
				result.Response.StatusText,
			)
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "Duration: %s\n", formatTemplatesRunDuration(result.Response.Duration))

			if runArgs.Verbose {
				printTemplatesRunVerboseOutput(cmd, result)
			}
			return nil
		},
	}

	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	cmd.Flags().String("secret", "", "Secret used for provider-specific signing placeholders")
	cmd.Flags().Bool("allow-env-placeholders", false, "Allow resolving $env:* placeholders from template content")
	cmd.Flags().StringArrayP("header", "H", nil, "Add or override header (format: key:value)")
	cmd.Flags().Duration("timeout", runtime.DefaultReplayTimeout, "HTTP request timeout")
	cmd.Flags().BoolP("verbose", "v", false, "Show detailed request/response information")
	return cmd
}

func validateRunCommandArgs(cmd *cobra.Command, args []string) error {
	if len(args) == 0 {
		return errors.New("template id is required")
	}
	if len(args) > 2 {
		return fmt.Errorf("too many arguments: expected <template-id> [target-url], received %d", len(args))
	}
	templateID := strings.TrimSpace(args[0])
	if templateID == "" {
		return errors.New("template id cannot be empty")
	}
	if len(args) == 2 && strings.TrimSpace(args[1]) == "" {
		return errors.New("target URL cannot be empty when provided")
	}
	return nil
}

func printTemplatesRunVerboseOutput(cmd *cobra.Command, result apptemplates.RunResult) {
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
	_, _ = fmt.Fprintln(cmd.OutOrStdout(), formatTemplatesRunBodyPreview(result.Response.Body, result.Response.BodyTruncated))
}

func formatTemplatesRunBodyPreview(body []byte, truncated bool) string {
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

func formatTemplatesRunDuration(value time.Duration) string {
	if value < time.Millisecond {
		return value.String()
	}
	return value.Round(time.Millisecond).String()
}
