package templates

import (
	"context"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
)

type LocalTemplateStore interface {
	List(ctx context.Context) ([]domain.LocalTemplate, error)
	Get(ctx context.Context, templateID string) (domain.LocalTemplate, error)
	Save(ctx context.Context, metadata domain.TemplateMetadata, template domain.WebhookTemplate, downloadedAt string) (domain.LocalTemplate, error)
	DeleteAll(ctx context.Context) (int, error)
}

type RemoteTemplateSource interface {
	FetchIndex(ctx context.Context) (domain.TemplatesIndex, error)
	FetchTemplate(ctx context.Context, templateFile string) (domain.WebhookTemplate, error)
}

type IndexCacheStore interface {
	Get(ctx context.Context) (CachedIndex, bool, error)
	Set(ctx context.Context, value CachedIndex) error
	Clear(ctx context.Context) error
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
