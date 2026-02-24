package httpcapture

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider"
	githubdetector "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider/github"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/storage/jsonc"
	appcapture "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/capture"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

func TestServerCapturesRequestWithRawBodyAndMeta(t *testing.T) {
	server, store := mustStartServer(t, "test-version")
	defer stopServer(t, server)

	body := `{"ref":"refs/heads/main"}`
	req, err := http.NewRequest(http.MethodPost, serverURL(server)+"/webhooks/github?env=test", strings.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("X-Hub-Signature-256", "sha256=abc")

	response, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("send request: %v", err)
	}
	defer func() {
		_ = response.Body.Close()
	}()

	if response.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 200 response, got %d (%s)", response.StatusCode, string(raw))
	}

	captures, err := store.List(context.Background(), 10)
	if err != nil {
		t.Fatalf("list captures: %v", err)
	}
	if len(captures) != 1 {
		t.Fatalf("expected one capture, got %d", len(captures))
	}

	capture := captures[0].Capture
	if capture.Provider != domain.ProviderGitHub {
		t.Fatalf("provider mismatch: got %q want %q", capture.Provider, domain.ProviderGitHub)
	}
	rawBody, err := base64.StdEncoding.DecodeString(capture.RawBodyBase64)
	if err != nil {
		t.Fatalf("decode raw body: %v", err)
	}
	if string(rawBody) != body {
		t.Fatalf("raw body mismatch: got %q want %q", string(rawBody), body)
	}
	if capture.Meta.BodyEncoding != domain.BodyEncodingBase64 {
		t.Fatalf("meta body encoding mismatch: got %q", capture.Meta.BodyEncoding)
	}
	if !hasHeaderCaseInsensitive(capture.Headers, "x-github-event") {
		t.Fatalf("expected captured github event header key")
	}
}

func TestServerAcceptsLargePayload(t *testing.T) {
	server, _ := mustStartServer(t, "test-version")
	defer stopServer(t, server)

	payload := strings.Repeat("x", 128*1024)
	response, err := http.Post(serverURL(server)+"/webhooks/test", "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatalf("send request: %v", err)
	}
	defer func() {
		_ = response.Body.Close()
	}()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 response, got %d", response.StatusCode)
	}
}

func TestServerRejectsPayloadLargerThanLimit(t *testing.T) {
	server, _ := mustStartServer(t, "test-version")
	defer stopServer(t, server)

	payload := strings.Repeat("x", int(maxRequestBodyBytes+1))
	response, err := http.Post(serverURL(server)+"/webhooks/test", "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatalf("send request: %v", err)
	}
	defer func() {
		_ = response.Body.Close()
	}()
	if response.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 response, got %d", response.StatusCode)
	}
}

func TestServerStoresAllCapturesWithoutRetentionLimit(t *testing.T) {
	server, store := mustStartServer(t, "test-version")
	defer stopServer(t, server)

	for i := 0; i < 3; i++ {
		response, err := http.Post(serverURL(server)+"/webhooks/test", "application/json", strings.NewReader(`{"idx":1}`))
		if err != nil {
			t.Fatalf("send request %d: %v", i, err)
		}
		_ = response.Body.Close()
	}

	captures, err := store.List(context.Background(), 10)
	if err != nil {
		t.Fatalf("list captures: %v", err)
	}
	if len(captures) != 3 {
		t.Fatalf("expected 3 captures with no retention limit, got %d", len(captures))
	}
}

func TestServerExposesStableAddrAccessor(t *testing.T) {
	server, _ := mustStartServer(t, "test-version")
	defer stopServer(t, server)

	if !strings.Contains(server.Addr(), ":") {
		t.Fatalf("expected addr accessor to include host:port, got %q", server.Addr())
	}
}

func TestServerWaitCanBeCalledMultipleTimes(t *testing.T) {
	server, _ := mustStartServer(t, "test-version")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Stop(shutdownCtx); err != nil {
		t.Fatalf("stop server: %v", err)
	}
	if err := server.Wait(); err != nil {
		t.Fatalf("first wait returned error: %v", err)
	}
	if err := server.Wait(); err != nil {
		t.Fatalf("second wait returned error: %v", err)
	}
}

func TestServerWaitReturnsErrorWhenNotStarted(t *testing.T) {
	store, err := jsonc.NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	captureService := appcapture.NewService(store, provider.NewRegistry(githubdetector.NewDetector()), nil, "test-version")
	server, err := NewServer(ServerOptions{
		Host:       "127.0.0.1",
		Port:       0,
		CaptureSvc: captureService,
	})
	if err != nil {
		t.Fatalf("create server: %v", err)
	}

	waitErr := server.Wait()
	if waitErr == nil {
		t.Fatalf("expected wait to fail when server is not started")
	}
	if !errors.Is(waitErr, errServerNotStarted) {
		t.Fatalf("expected %v error, got %v", errServerNotStarted, waitErr)
	}
}

func TestServerReturnsTimeoutWhenStoreSaveCancelled(t *testing.T) {
	captureService := appcapture.NewService(&saveCanceledStore{}, nil, nil, "test-version")
	server, err := NewServer(ServerOptions{
		Host:       "127.0.0.1",
		Port:       0,
		CaptureSvc: captureService,
	})
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	if _, err := server.Start(); err != nil {
		t.Fatalf("start server: %v", err)
	}
	defer stopServer(t, server)

	response, err := http.Post(serverURL(server)+"/webhooks/test", "application/json", strings.NewReader(`{"a":1}`))
	if err != nil {
		t.Fatalf("send request: %v", err)
	}
	defer func() {
		_ = response.Body.Close()
	}()
	if response.StatusCode != http.StatusRequestTimeout {
		t.Fatalf("expected 408 response when store save is cancelled, got %d", response.StatusCode)
	}
}

func mustStartServer(t *testing.T, toolVersion string) (*Server, *jsonc.Store) {
	t.Helper()
	store, err := jsonc.NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	detector := provider.NewRegistry(
		githubdetector.NewDetector(),
	)
	captureService := appcapture.NewService(store, detector, nil, toolVersion)
	server, err := NewServer(ServerOptions{
		Host:       "127.0.0.1",
		Port:       0,
		CaptureSvc: captureService,
	})
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	if _, err := server.Start(); err != nil {
		t.Fatalf("start server: %v", err)
	}
	return server, store
}

func stopServer(t *testing.T, server *Server) {
	t.Helper()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Stop(shutdownCtx); err != nil {
		t.Fatalf("stop server: %v", err)
	}
	if err := server.Wait(); err != nil {
		t.Fatalf("wait server: %v", err)
	}
}

func serverURL(server *Server) string {
	return "http://" + server.Addr()
}

func hasHeaderCaseInsensitive(headers []domain.HeaderEntry, key string) bool {
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			return true
		}
	}
	return false
}

type saveCanceledStore struct{}

func (s *saveCanceledStore) EnsureStorageDir(context.Context) error {
	return nil
}

func (s *saveCanceledStore) BuildBaseRecord(string) domain.CaptureRecord {
	return domain.CaptureRecord{
		ID:        "id-1",
		Timestamp: "2026-02-21T12:00:00Z",
		Provider:  domain.ProviderUnknown,
		Meta: domain.CaptureMeta{
			StoredAt:           "2026-02-21T12:00:00Z",
			BodyEncoding:       domain.BodyEncodingBase64,
			CaptureToolVersion: "test",
		},
	}
}

func (s *saveCanceledStore) Save(context.Context, domain.CaptureRecord) (domain.CaptureFile, error) {
	return domain.CaptureFile{}, context.Canceled
}
