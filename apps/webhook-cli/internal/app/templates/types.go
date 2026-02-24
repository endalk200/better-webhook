package templates

import (
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
)

type CachedIndex struct {
	Index    domain.TemplatesIndex
	CachedAt time.Time
}

type DownloadAllResult struct {
	Total      int
	Skipped    int
	Downloaded int
	Failed     int
	FailedIDs  []string
}

type SearchResult struct {
	Local  []domain.LocalTemplate
	Remote []domain.RemoteTemplate
}

type RunRequest struct {
	TemplateID           string
	TargetURL            string
	Secret               string
	AllowEnvPlaceholders bool
	HeaderOverrides      []domain.HeaderEntry
	Timeout              time.Duration
}

type RunResult struct {
	TemplateID  string
	Provider    string
	Event       string
	TargetURL   string
	Method      string
	SentHeaders []domain.HeaderEntry
	Response    RunResponse
}

type RunResponse struct {
	StatusCode    int
	StatusText    string
	Headers       []domain.HeaderEntry
	Body          []byte
	BodyTruncated bool
	Duration      time.Duration
}
