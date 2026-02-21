package replay

import (
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

type ReplayRequest struct {
	Selector        string
	TargetURL       string
	BaseURL         string
	MethodOverride  string
	HeaderOverrides []domain.HeaderEntry
	Timeout         time.Duration
}

type ReplayResult struct {
	Capture     domain.CaptureFile
	TargetURL   string
	Method      string
	SentHeaders []domain.HeaderEntry
	Response    ReplayResponse
}

type ReplayResponse struct {
	StatusCode    int
	StatusText    string
	Headers       []domain.HeaderEntry
	Body          []byte
	BodyTruncated bool
	Duration      time.Duration
}
