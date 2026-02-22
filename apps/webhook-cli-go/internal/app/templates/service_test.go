package templates

import (
	"context"
	"errors"
	"testing"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

func TestListRemoteMarksDownloadedTemplates(t *testing.T) {
	service := NewService(
		&localStoreStub{
			items: []domain.LocalTemplate{{ID: "github-push"}},
		},
		&remoteStoreStub{
			index: domain.TemplatesIndex{
				Version: "1.0.0",
				Templates: []domain.TemplateMetadata{
					{ID: "github-push", Name: "GitHub Push", Provider: "github", Event: "push", File: "github/github-push.json"},
					{ID: "github-issues", Name: "GitHub Issues", Provider: "github", Event: "issues", File: "github/github-issues.json"},
				},
			},
		},
		&cacheStoreStub{},
		clockStub{now: time.Date(2026, time.February, 22, 11, 0, 0, 0, time.UTC)},
	)
	items, err := service.ListRemote(context.Background(), "github", false)
	if err != nil {
		t.Fatalf("list remote: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 templates, got %d", len(items))
	}
	if !items[0].IsDownloaded {
		t.Fatalf("expected github-push to be marked downloaded")
	}
}

func TestDownloadReturnsTemplateNotFound(t *testing.T) {
	service := NewService(
		&localStoreStub{},
		&remoteStoreStub{
			index: domain.TemplatesIndex{
				Version:   "1.0.0",
				Templates: []domain.TemplateMetadata{},
			},
		},
		&cacheStoreStub{},
		clockStub{now: time.Now().UTC()},
	)
	_, err := service.Download(context.Background(), "missing-id", false)
	if !errors.Is(err, domain.ErrTemplateNotFound) {
		t.Fatalf("expected template not found error, got %v", err)
	}
}

func TestDownloadAllCountsSkippedDownloadedAndFailed(t *testing.T) {
	service := NewService(
		&localStoreStub{
			items: []domain.LocalTemplate{{ID: "already-downloaded"}},
			saveErrByID: map[string]error{
				"save-fails": errors.New("disk full"),
			},
		},
		&remoteStoreStub{
			index: domain.TemplatesIndex{
				Version: "1.0.0",
				Templates: []domain.TemplateMetadata{
					{ID: "already-downloaded", Name: "A", Provider: "github", Event: "push", File: "github/a.json"},
					{ID: "good", Name: "B", Provider: "github", Event: "issues", File: "github/b.json"},
					{ID: "fetch-fails", Name: "C", Provider: "github", Event: "pull_request", File: "github/c.json"},
					{ID: "save-fails", Name: "D", Provider: "github", Event: "installation", File: "github/d.json"},
				},
			},
			templateErrByFile: map[string]error{
				"github/c.json": errors.New("network"),
			},
		},
		&cacheStoreStub{},
		clockStub{now: time.Now().UTC()},
	)
	result, err := service.DownloadAll(context.Background(), true)
	if err != nil {
		t.Fatalf("download all: %v", err)
	}
	if result.Total != 4 {
		t.Fatalf("total mismatch: got %d", result.Total)
	}
	if result.Skipped != 1 {
		t.Fatalf("skipped mismatch: got %d", result.Skipped)
	}
	if result.Downloaded != 1 {
		t.Fatalf("downloaded mismatch: got %d", result.Downloaded)
	}
	if result.Failed != 2 {
		t.Fatalf("failed mismatch: got %d", result.Failed)
	}
}

func TestSearchReturnsMatchesFromLocalAndRemote(t *testing.T) {
	service := NewService(
		&localStoreStub{
			items: []domain.LocalTemplate{
				{
					ID: "github-push",
					Metadata: domain.TemplateMetadata{
						ID:       "github-push",
						Name:     "GitHub Push",
						Provider: "github",
						Event:    "push",
						File:     "github/github-push.json",
					},
				},
			},
		},
		&remoteStoreStub{
			index: domain.TemplatesIndex{
				Version: "1.0.0",
				Templates: []domain.TemplateMetadata{
					{ID: "github-push", Name: "GitHub Push", Provider: "github", Event: "push", File: "github/github-push.json"},
					{ID: "github-issues", Name: "GitHub Issues", Provider: "github", Event: "issues", File: "github/github-issues.json"},
				},
			},
		},
		&cacheStoreStub{},
		clockStub{now: time.Now().UTC()},
	)
	result, err := service.Search(context.Background(), "issues", "", false)
	if err != nil {
		t.Fatalf("search templates: %v", err)
	}
	if len(result.Local) != 0 {
		t.Fatalf("expected no local matches, got %d", len(result.Local))
	}
	if len(result.Remote) != 1 || result.Remote[0].Metadata.ID != "github-issues" {
		t.Fatalf("expected github-issues remote match")
	}
}

func TestListRemoteFallsBackToStaleCacheWhenRemoteFails(t *testing.T) {
	now := time.Date(2026, time.February, 22, 11, 0, 0, 0, time.UTC)
	cache := &cacheStoreStub{
		cached: CachedIndex{
			Index: domain.TemplatesIndex{
				Version: "1.0.0",
				Templates: []domain.TemplateMetadata{
					{ID: "from-cache", Name: "From Cache", Provider: "github", Event: "push", File: "github/from-cache.json"},
				},
			},
			CachedAt: now.Add(-2 * time.Hour),
		},
		cacheHit: true,
	}
	service := NewService(
		&localStoreStub{},
		&remoteStoreStub{
			err: errors.New("upstream unavailable"),
		},
		cache,
		clockStub{now: now},
	)
	items, err := service.ListRemote(context.Background(), "", false)
	if err != nil {
		t.Fatalf("list remote with stale cache fallback: %v", err)
	}
	if len(items) != 1 || items[0].Metadata.ID != "from-cache" {
		t.Fatalf("expected stale cache template fallback")
	}
}

func TestNewServicePanicsOnNilDependencies(t *testing.T) {
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatalf("expected panic when dependencies are nil")
		}
	}()
	_ = NewService(nil, &remoteStoreStub{}, &cacheStoreStub{}, clockStub{now: time.Now().UTC()})
}

type localStoreStub struct {
	items       []domain.LocalTemplate
	saveErrByID map[string]error
}

func (s *localStoreStub) List(context.Context) ([]domain.LocalTemplate, error) {
	return s.items, nil
}

func (s *localStoreStub) Save(_ context.Context, metadata domain.TemplateMetadata, template domain.WebhookTemplate, downloadedAt string) (domain.LocalTemplate, error) {
	if err, ok := s.saveErrByID[metadata.ID]; ok {
		return domain.LocalTemplate{}, err
	}
	item := domain.LocalTemplate{
		ID:           metadata.ID,
		Metadata:     metadata,
		Template:     template,
		DownloadedAt: downloadedAt,
		FilePath:     metadata.File,
	}
	s.items = append(s.items, item)
	return item, nil
}

func (s *localStoreStub) DeleteAll(context.Context) (int, error) {
	deleted := len(s.items)
	s.items = nil
	return deleted, nil
}

type remoteStoreStub struct {
	index             domain.TemplatesIndex
	err               error
	templateErrByFile map[string]error
}

func (s *remoteStoreStub) FetchIndex(context.Context) (domain.TemplatesIndex, error) {
	if s.err != nil {
		return domain.TemplatesIndex{}, s.err
	}
	return s.index, nil
}

func (s *remoteStoreStub) FetchTemplate(_ context.Context, templateFile string) (domain.WebhookTemplate, error) {
	if err, ok := s.templateErrByFile[templateFile]; ok {
		return domain.WebhookTemplate{}, err
	}
	return domain.WebhookTemplate{
		Method: "POST",
		Body:   []byte(`{"ok":true}`),
	}, nil
}

type cacheStoreStub struct {
	cached   CachedIndex
	cacheHit bool
}

func (s *cacheStoreStub) Get(context.Context) (CachedIndex, bool, error) {
	return s.cached, s.cacheHit, nil
}

func (s *cacheStoreStub) Set(_ context.Context, value CachedIndex) error {
	s.cached = value
	s.cacheHit = true
	return nil
}

func (s *cacheStoreStub) Clear(context.Context) error {
	s.cacheHit = false
	return nil
}

type clockStub struct {
	now time.Time
}

func (c clockStub) Now() time.Time {
	return c.now
}
