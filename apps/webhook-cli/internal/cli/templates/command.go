package templates

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
	platformplaceholders "github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/placeholders"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

type ServiceFactory func(templatesDir string) (*apptemplates.Service, error)

type Dependencies struct {
	ServiceFactory ServiceFactory
	Prompter       ui.Prompter
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "templates",
		Aliases: []string{"t"},
		Short:   "Manage webhook templates",
	}

	cmd.AddCommand(newListCommand(deps))
	cmd.AddCommand(newDownloadCommand(deps))
	cmd.AddCommand(newDeleteCommand(deps))
	cmd.AddCommand(newSearchCommand(deps))
	cmd.AddCommand(newCacheCommand(deps))
	cmd.AddCommand(newCleanCommand(deps))
	cmd.AddCommand(newRunCommand(deps))
	return cmd
}

func mapTemplateCommandError(err error, templateID string) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, domain.ErrTemplateNotFound) {
		if strings.TrimSpace(templateID) == "" {
			return fmt.Errorf("%w", domain.ErrTemplateNotFound)
		}
		return fmt.Errorf("%w: %s", domain.ErrTemplateNotFound, strings.TrimSpace(templateID))
	}
	if errors.Is(err, domain.ErrInvalidTemplateID) {
		return fmt.Errorf("%w", domain.ErrInvalidTemplateID)
	}
	if errors.Is(err, domain.ErrInvalidTemplateQuery) {
		return fmt.Errorf("search query cannot be empty: %w", err)
	}
	if errors.Is(err, domain.ErrTemplateIndexUnavailable) {
		return fmt.Errorf("%w", domain.ErrTemplateIndexUnavailable)
	}
	if errors.Is(err, apptemplates.ErrRunNotConfigured) {
		return fmt.Errorf("template execution is not configured: %w", err)
	}
	if errors.Is(err, apptemplates.ErrRunTargetURLRequired) {
		return fmt.Errorf("target URL is required: provide [target-url] or set template.url: %w", err)
	}
	if errors.Is(err, apptemplates.ErrRunInvalidTargetURL) {
		return fmt.Errorf("target URL is invalid: %w", err)
	}
	if errors.Is(err, apptemplates.ErrRunInvalidMethod) {
		return fmt.Errorf("template method is invalid: %w", err)
	}
	if errors.Is(err, apptemplates.ErrRunInvalidBody) {
		return mapRunInvalidBodyError(err)
	}
	if errors.Is(err, apptemplates.ErrRunTimeoutInvalid) {
		return fmt.Errorf("timeout must be greater than 0: %w", err)
	}
	if errors.Is(err, apptemplates.ErrRunSecretRequired) {
		return fmt.Errorf("secret is required for provider signing placeholder: %w", err)
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("operation cancelled: %w", err)
	}
	return err
}

func mapRunInvalidBodyError(err error) error {
	cause := runInvalidBodyCause(err)
	if cause == nil {
		return fmt.Errorf("template body is invalid: %w", err)
	}
	if errors.Is(cause, platformplaceholders.ErrEnvironmentPlaceholdersDisabled) {
		return fmt.Errorf(
			"template body is invalid: environment placeholders are disabled (use --allow-env-placeholders): %w",
			err,
		)
	}
	return fmt.Errorf("template body is invalid: %w", err)
}

func runInvalidBodyCause(err error) error {
	joined, ok := err.(interface{ Unwrap() []error })
	if !ok {
		return errors.Unwrap(err)
	}
	for _, wrapped := range joined.Unwrap() {
		if errors.Is(wrapped, apptemplates.ErrRunInvalidBody) {
			continue
		}
		return wrapped
	}
	return nil
}
