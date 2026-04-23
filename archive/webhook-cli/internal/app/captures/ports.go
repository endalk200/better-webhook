package captures

import (
	"context"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

type CaptureRepository interface {
	// List returns up to limit captures ordered by most recent first.
	// limit must be a positive integer.
	List(ctx context.Context, limit int) ([]domain.CaptureFile, error)
	ResolveByIDOrPrefix(ctx context.Context, selector string) (domain.CaptureFile, error)
	DeleteByIDOrPrefix(ctx context.Context, selector string) (domain.CaptureFile, error)
	DeleteByFile(ctx context.Context, file string) error
}
