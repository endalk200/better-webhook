package templates

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
	platformplaceholders "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/placeholders"
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
					{ID: "github-push", Name: "GitHub Push", Provider: "github", Event: "push", File: "github/github-push.jsonc"},
					{ID: "github-issues", Name: "GitHub Issues", Provider: "github", Event: "issues", File: "github/github-issues.jsonc"},
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
					{ID: "already-downloaded", Name: "A", Provider: "github", Event: "push", File: "github/a.jsonc"},
					{ID: "good", Name: "B", Provider: "github", Event: "issues", File: "github/b.jsonc"},
					{ID: "fetch-fails", Name: "C", Provider: "github", Event: "pull_request", File: "github/c.jsonc"},
					{ID: "save-fails", Name: "D", Provider: "github", Event: "installation", File: "github/d.jsonc"},
				},
			},
			templateErrByFile: map[string]error{
				"github/c.jsonc": errors.New("network"),
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
						File:     "github/github-push.jsonc",
					},
				},
			},
		},
		&remoteStoreStub{
			index: domain.TemplatesIndex{
				Version: "1.0.0",
				Templates: []domain.TemplateMetadata{
					{ID: "github-push", Name: "GitHub Push", Provider: "github", Event: "push", File: "github/github-push.jsonc"},
					{ID: "github-issues", Name: "GitHub Issues", Provider: "github", Event: "issues", File: "github/github-issues.jsonc"},
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

func TestSearchReadsLocalStoreOnce(t *testing.T) {
	localStore := &localStoreStub{
		items: []domain.LocalTemplate{
			{
				ID: "github-push",
				Metadata: domain.TemplateMetadata{
					ID:       "github-push",
					Name:     "GitHub Push",
					Provider: "github",
					Event:    "push",
					File:     "github/github-push.jsonc",
				},
			},
		},
	}
	service := NewService(
		localStore,
		&remoteStoreStub{
			index: domain.TemplatesIndex{
				Version: "1.0.0",
				Templates: []domain.TemplateMetadata{
					{ID: "github-push", Name: "GitHub Push", Provider: "github", Event: "push", File: "github/github-push.jsonc"},
				},
			},
		},
		&cacheStoreStub{},
		clockStub{now: time.Now().UTC()},
	)
	if _, err := service.Search(context.Background(), "github", "", false); err != nil {
		t.Fatalf("search templates: %v", err)
	}
	if localStore.listCalls != 1 {
		t.Fatalf("expected one local store list call, got %d", localStore.listCalls)
	}
}

func TestListRemoteFallsBackToStaleCacheWhenRemoteFails(t *testing.T) {
	now := time.Date(2026, time.February, 22, 11, 0, 0, 0, time.UTC)
	cache := &cacheStoreStub{
		cached: CachedIndex{
			Index: domain.TemplatesIndex{
				Version: "1.0.0",
				Templates: []domain.TemplateMetadata{
					{ID: "from-cache", Name: "From Cache", Provider: "github", Event: "push", File: "github/from-cache.jsonc"},
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
	validLocal := &localStoreStub{}
	validRemote := &remoteStoreStub{}
	validCache := &cacheStoreStub{}
	validClock := clockStub{now: time.Now().UTC()}

	assertPanics := func(t *testing.T, name string, fn func()) {
		t.Helper()
		t.Run(name, func(t *testing.T) {
			defer func() {
				if recovered := recover(); recovered == nil {
					t.Fatalf("expected panic")
				}
			}()
			fn()
		})
	}

	assertPanics(t, "nil local store", func() {
		_ = NewService(nil, validRemote, validCache, validClock)
	})
	assertPanics(t, "nil remote store", func() {
		_ = NewService(validLocal, nil, validCache, validClock)
	})
	assertPanics(t, "nil cache store", func() {
		_ = NewService(validLocal, validRemote, nil, validClock)
	})
}

func TestNewServiceAllowsNilClock(t *testing.T) {
	service := NewService(&localStoreStub{}, &remoteStoreStub{}, &cacheStoreStub{}, nil)
	if service.clock == nil {
		t.Fatalf("expected nil clock to fall back to a system clock")
	}
}

func TestRunResolvesPlaceholdersAndSignsGitHubPayload(t *testing.T) {
	now := time.Date(2026, time.February, 22, 11, 0, 0, 0, time.UTC)
	dispatcher := &dispatcherStub{
		result: DispatchResult{
			StatusCode: 200,
			StatusText: "OK",
		},
	}
	lookupEnv := mapLookup(map[string]string{
		"PAYLOAD_SOURCE": "tests",
		"HEADER_VALUE":   "header-from-env",
	})
	resolver := platformplaceholders.NewResolver(clockStub{now: now}, idGeneratorStub{id: "delivery-uuid"}, lookupEnv)
	service := NewService(
		&localStoreStub{
			items: []domain.LocalTemplate{
				{
					ID: "github-push",
					Metadata: domain.TemplateMetadata{
						ID:       "github-push",
						Provider: "github",
						Event:    "push",
					},
					Template: domain.WebhookTemplate{
						Method:   "POST",
						Provider: "github",
						Headers: []domain.HeaderEntry{
							{Key: "X-GitHub-Delivery", Value: "$uuid"},
							{Key: "X-From-Env", Value: "$env:HEADER_VALUE"},
							{Key: "X-Hub-Signature-256", Value: "$github:x-hub-signature-256"},
						},
						Body: []byte(`{"source":"$env:PAYLOAD_SOURCE","sent_at":"$time:rfc3339"}`),
					},
				},
			},
		},
		&remoteStoreStub{},
		&cacheStoreStub{},
		clockStub{now: now},
		WithDispatcher(dispatcher),
		WithPlaceholderResolver(resolver),
		WithEnvironmentLookup(func(string) (string, bool) { return "", false }),
	)
	result, err := service.Run(context.Background(), RunRequest{
		TemplateID:           "github-push",
		TargetURL:            "http://localhost:3000/webhooks/github",
		Secret:               "top-secret",
		AllowEnvPlaceholders: true,
		Timeout:              5 * time.Second,
	})
	if err != nil {
		t.Fatalf("run template: %v", err)
	}
	if dispatcher.calls != 1 {
		t.Fatalf("expected one dispatch call, got %d", dispatcher.calls)
	}
	if result.Response.StatusCode != 200 {
		t.Fatalf("status mismatch: got %d", result.Response.StatusCode)
	}
	body := map[string]string{}
	if err := json.Unmarshal(dispatcher.lastRequest.Body, &body); err != nil {
		t.Fatalf("unmarshal resolved body: %v", err)
	}
	if body["source"] != "tests" {
		t.Fatalf("expected source from env, got %q", body["source"])
	}
	if body["sent_at"] != now.Format(time.RFC3339) {
		t.Fatalf("expected RFC3339 time, got %q", body["sent_at"])
	}
	if got := headerValue(dispatcher.lastRequest.Headers, "X-GitHub-Delivery"); got != "delivery-uuid" {
		t.Fatalf("delivery header mismatch: got %q", got)
	}
	if got := headerValue(dispatcher.lastRequest.Headers, "X-From-Env"); got != "header-from-env" {
		t.Fatalf("env header mismatch: got %q", got)
	}
	expectedSignature := computeSignatureHex(dispatcher.lastRequest.Body, "top-secret")
	if got := headerValue(dispatcher.lastRequest.Headers, "X-Hub-Signature-256"); got != expectedSignature {
		t.Fatalf("signature mismatch: got %q want %q", got, expectedSignature)
	}
}

func TestRunInterpolatesPlaceholdersInBodyAndHeaders(t *testing.T) {
	now := time.Date(2026, time.February, 22, 11, 0, 0, 0, time.UTC)
	dispatcher := &dispatcherStub{
		result: DispatchResult{
			StatusCode: 200,
			StatusText: "OK",
		},
	}
	lookupEnv := mapLookup(map[string]string{
		"BW_SOURCE": "tests",
	})
	resolver := platformplaceholders.NewResolver(clockStub{now: now}, idGeneratorStub{id: "delivery-uuid"}, lookupEnv)
	service := NewService(
		&localStoreStub{
			items: []domain.LocalTemplate{
				{
					ID: "github-push",
					Metadata: domain.TemplateMetadata{
						ID:       "github-push",
						Provider: "github",
						Event:    "push",
					},
					Template: domain.WebhookTemplate{
						Method:   "POST",
						Provider: "github",
						Headers: []domain.HeaderEntry{
							{Key: "X-Request-ID", Value: "req-$uuid"},
						},
						Body: []byte(`{"source":"src-$env:BW_SOURCE","sent_at":"at-$time:rfc3339","escaped":"\\$uuid"}`),
					},
				},
			},
		},
		&remoteStoreStub{},
		&cacheStoreStub{},
		clockStub{now: now},
		WithDispatcher(dispatcher),
		WithPlaceholderResolver(resolver),
		WithEnvironmentLookup(func(string) (string, bool) { return "", false }),
	)
	_, err := service.Run(context.Background(), RunRequest{
		TemplateID:           "github-push",
		TargetURL:            "http://localhost:3000/webhooks/github",
		AllowEnvPlaceholders: true,
		Timeout:              5 * time.Second,
	})
	if err != nil {
		t.Fatalf("run template: %v", err)
	}

	if got := headerValue(dispatcher.lastRequest.Headers, "X-Request-ID"); got != "req-delivery-uuid" {
		t.Fatalf("interpolated request id mismatch: got %q", got)
	}

	body := map[string]string{}
	if err := json.Unmarshal(dispatcher.lastRequest.Body, &body); err != nil {
		t.Fatalf("unmarshal interpolated body: %v", err)
	}
	if body["source"] != "src-tests" {
		t.Fatalf("interpolated source mismatch: got %q", body["source"])
	}
	if body["sent_at"] != "at-"+now.Format(time.RFC3339) {
		t.Fatalf("interpolated sent_at mismatch: got %q", body["sent_at"])
	}
	if body["escaped"] != "$uuid" {
		t.Fatalf("escaped placeholder mismatch: got %q", body["escaped"])
	}
}

func TestRunReturnsSecretRequiredWhenGithubSignaturePlaceholderPresent(t *testing.T) {
	now := time.Date(2026, time.February, 22, 11, 0, 0, 0, time.UTC)
	dispatcher := &dispatcherStub{}
	service := NewService(
		&localStoreStub{
			items: []domain.LocalTemplate{
				{
					ID: "github-push",
					Metadata: domain.TemplateMetadata{
						ID:       "github-push",
						Provider: "github",
						Event:    "push",
					},
					Template: domain.WebhookTemplate{
						Method:   "POST",
						Provider: "github",
						Headers: []domain.HeaderEntry{
							{Key: "X-Hub-Signature-256", Value: "$github:x-hub-signature-256"},
						},
						Body: []byte(`{"ok":true}`),
					},
				},
			},
		},
		&remoteStoreStub{},
		&cacheStoreStub{},
		clockStub{now: now},
		WithDispatcher(dispatcher),
		WithPlaceholderResolver(platformplaceholders.NewResolver(clockStub{now: now}, nil, func(string) (string, bool) { return "", false })),
		WithEnvironmentLookup(func(string) (string, bool) { return "", false }),
	)
	_, err := service.Run(context.Background(), RunRequest{
		TemplateID: "github-push",
		TargetURL:  "http://localhost:3000/webhooks/github",
		Timeout:    5 * time.Second,
	})
	if !errors.Is(err, ErrRunSecretRequired) {
		t.Fatalf("expected ErrRunSecretRequired, got %v", err)
	}
	if dispatcher.calls != 0 {
		t.Fatalf("expected no dispatch calls")
	}
}

func TestRunAppliesHeaderOverrides(t *testing.T) {
	now := time.Date(2026, time.February, 22, 11, 0, 0, 0, time.UTC)
	dispatcher := &dispatcherStub{
		result: DispatchResult{StatusCode: 202, StatusText: "Accepted"},
	}
	service := NewService(
		&localStoreStub{
			items: []domain.LocalTemplate{
				{
					ID: "github-push",
					Metadata: domain.TemplateMetadata{
						ID:       "github-push",
						Provider: "github",
						Event:    "push",
					},
					Template: domain.WebhookTemplate{
						Method: "POST",
						Headers: []domain.HeaderEntry{
							{Key: "X-Test", Value: "one"},
						},
						Body: []byte(`{"ok":true}`),
					},
				},
			},
		},
		&remoteStoreStub{},
		&cacheStoreStub{},
		clockStub{now: now},
		WithDispatcher(dispatcher),
	)
	_, err := service.Run(context.Background(), RunRequest{
		TemplateID: "github-push",
		TargetURL:  "http://localhost:3000/webhooks/github",
		Timeout:    5 * time.Second,
		HeaderOverrides: []domain.HeaderEntry{
			{Key: "X-Test", Value: "two"},
			{Key: "X-New", Value: "three"},
		},
	})
	if err != nil {
		t.Fatalf("run template: %v", err)
	}
	if got := headerValue(dispatcher.lastRequest.Headers, "X-Test"); got != "two" {
		t.Fatalf("expected overridden header, got %q", got)
	}
	if got := headerValue(dispatcher.lastRequest.Headers, "X-New"); got != "three" {
		t.Fatalf("expected new header, got %q", got)
	}
}

type localStoreStub struct {
	items       []domain.LocalTemplate
	saveErrByID map[string]error
	listCalls   int
}

func (s *localStoreStub) List(context.Context) ([]domain.LocalTemplate, error) {
	s.listCalls++
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

type dispatcherStub struct {
	lastRequest DispatchRequest
	result      DispatchResult
	err         error
	calls       int
}

func (s *dispatcherStub) Dispatch(_ context.Context, request DispatchRequest) (DispatchResult, error) {
	s.calls++
	s.lastRequest = request
	if s.err != nil {
		return DispatchResult{}, s.err
	}
	return s.result, nil
}

type idGeneratorStub struct {
	id string
}

func (s idGeneratorStub) NewID() string {
	return s.id
}

func mapLookup(values map[string]string) func(string) (string, bool) {
	return func(key string) (string, bool) {
		value, ok := values[key]
		return value, ok
	}
}

func headerValue(headers []domain.HeaderEntry, key string) string {
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			return header.Value
		}
	}
	return ""
}

func computeSignatureHex(body []byte, secret string) string {
	signature := hmac.New(sha256.New, []byte(secret))
	_, _ = signature.Write(body)
	return "sha256=" + hex.EncodeToString(signature.Sum(nil))
}
