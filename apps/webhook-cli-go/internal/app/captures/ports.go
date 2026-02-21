package captures

import (
	"context"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

type CaptureRepository interface {
	List(ctx context.Context, limit int) ([]domain.CaptureFile, error)
	ResolveByIDOrPrefix(ctx context.Context, selector string) (domain.CaptureFile, error)
	DeleteByIDOrPrefix(ctx context.Context, selector string) (domain.CaptureFile, error)
}
