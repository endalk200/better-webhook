package replay

import (
	"context"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

type CaptureRepository interface {
	ResolveByIDOrPrefix(ctx context.Context, selector string) (domain.CaptureFile, error)
}

type Dispatcher interface {
	Dispatch(ctx context.Context, request DispatchRequest) (DispatchResult, error)
}

type DispatchRequest struct {
	Method  string
	URL     string
	Headers []domain.HeaderEntry
	Body    []byte
	Timeout time.Duration
}

type DispatchResult struct {
	StatusCode    int
	StatusText    string
	Headers       []domain.HeaderEntry
	Body          []byte
	BodyTruncated bool
	Duration      time.Duration
}
