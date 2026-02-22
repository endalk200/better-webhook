package template

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

func TestCacheGetReturnsMissForMissingFile(t *testing.T) {
	cache, err := NewCache(filepath.Join(t.TempDir(), "cache.json"))
	if err != nil {
		t.Fatalf("create cache: %v", err)
	}
	_, ok, err := cache.Get(context.Background())
	if err != nil {
		t.Fatalf("cache get: %v", err)
	}
	if ok {
		t.Fatalf("expected cache miss")
	}
}

func TestCacheSetAndGetRoundTrip(t *testing.T) {
	cache, err := NewCache(filepath.Join(t.TempDir(), "cache.json"))
	if err != nil {
		t.Fatalf("create cache: %v", err)
	}
	now := time.Date(2026, time.February, 22, 10, 0, 0, 0, time.UTC)
	if err := cache.Set(context.Background(), apptemplates.CachedIndex{
		Index: domain.TemplatesIndex{
			Version: "1.0.0",
			Templates: []domain.TemplateMetadata{
				{
					ID:       "github-push",
					Name:     "GitHub Push",
					Provider: "github",
					Event:    "push",
					File:     "github/github-push.jsonc",
				},
			},
		},
		CachedAt: now,
	}); err != nil {
		t.Fatalf("cache set: %v", err)
	}
	got, ok, err := cache.Get(context.Background())
	if err != nil {
		t.Fatalf("cache get: %v", err)
	}
	if !ok {
		t.Fatalf("expected cache hit")
	}
	if !got.CachedAt.UTC().Equal(now) {
		t.Fatalf("cached at mismatch: got %s want %s", got.CachedAt, now)
	}
	if len(got.Index.Templates) != 1 {
		t.Fatalf("template count mismatch: got %d", len(got.Index.Templates))
	}
}

func TestCacheClear(t *testing.T) {
	cache, err := NewCache(filepath.Join(t.TempDir(), "cache.json"))
	if err != nil {
		t.Fatalf("create cache: %v", err)
	}
	if err := cache.Set(context.Background(), apptemplates.CachedIndex{
		Index:    domain.TemplatesIndex{Version: "1.0.0"},
		CachedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("cache set: %v", err)
	}
	if err := cache.Clear(context.Background()); err != nil {
		t.Fatalf("cache clear: %v", err)
	}
	_, ok, err := cache.Get(context.Background())
	if err != nil {
		t.Fatalf("cache get: %v", err)
	}
	if ok {
		t.Fatalf("expected cache miss after clear")
	}
}
