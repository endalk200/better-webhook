package templates

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
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

			var result apptemplates.RunResult
			err = ui.WithSpinner(ctx, "Running template...", cmd.OutOrStdout(), func(spinnerCtx context.Context) error {
				var runErr error
				result, runErr = service.Run(spinnerCtx, apptemplates.RunRequest{
					TemplateID:           runArgs.TemplateID,
					TargetURL:            runArgs.TargetURL,
					Secret:               runArgs.Secret,
					AllowEnvPlaceholders: runArgs.AllowEnvPlaceholders,
					HeaderOverrides:      headerOverrides,
					Timeout:              runArgs.Timeout,
				})
				return runErr
			})
			if err != nil {
				return mapTemplateCommandError(err, runArgs.TemplateID)
			}

			_, _ = fmt.Fprintf(
				cmd.OutOrStdout(),
				"%s %s %s %s %s %s\n",
				ui.FormatSuccess("Executed"),
				ui.Muted.Render(result.TemplateID),
				ui.FormatProvider(result.Provider),
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

			if runArgs.Verbose {
				ui.PrintTemplateRunVerboseOutput(cmd.OutOrStdout(), result)
			}
			return nil
		},
	}

	cmd.Flags().String("templates-dir", "", "Directory where templates are stored")
	cmd.Flags().String("secret", "", "Secret used for provider-specific signing placeholders")
	cmd.Flags().Bool("allow-env-placeholders", false, "Allow resolving $env:* placeholders from template content")
	cmd.Flags().StringArrayP("header", "H", nil, "Add or override header (format: key:value)")
	cmd.Flags().Duration("timeout", runtime.DefaultTemplateRunTimeout, "HTTP request timeout")
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
