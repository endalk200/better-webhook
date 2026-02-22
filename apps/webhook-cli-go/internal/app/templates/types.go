package templates

import (
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
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
