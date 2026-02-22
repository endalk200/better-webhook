package templates

import (
	"context"
	"errors"
	"fmt"
	"strings"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
	"github.com/spf13/cobra"
)

type ServiceFactory func(templatesDir string) (*apptemplates.Service, error)

type Dependencies struct {
	ServiceFactory ServiceFactory
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "templates",
		Aliases: []string{"t"},
		Short:   "Manage webhook templates",
	}

	cmd.AddCommand(newListCommand(deps))
	cmd.AddCommand(newDownloadCommand(deps))
	cmd.AddCommand(newLocalCommand(deps))
	cmd.AddCommand(newSearchCommand(deps))
	cmd.AddCommand(newCacheCommand(deps))
	cmd.AddCommand(newCleanCommand(deps))
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
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("operation cancelled: %w", err)
	}
	return err
}
