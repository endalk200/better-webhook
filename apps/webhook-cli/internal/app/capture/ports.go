package capture

import (
	"context"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

type CaptureRepository interface {
	EnsureStorageDir(ctx context.Context) error
	BuildBaseRecord(toolVersion string) domain.CaptureRecord
	Save(ctx context.Context, capture domain.CaptureRecord) (domain.CaptureFile, error)
}

type ProviderDetector interface {
	Detect(ctx domain.DetectionContext) domain.DetectionResult
}

type RelayDispatcher interface {
	OnCaptureStored(ctx context.Context, capture domain.CaptureFile) error
}
