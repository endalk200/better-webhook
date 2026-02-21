package root

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	configtoml "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/config/toml"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/provider"
	githubdetector "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/provider/github"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/storage/jsonc"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/transport/httpcapture"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/transport/httpreplay"
	appcapture "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/capture"
	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/captures"
	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/replay"
	capturecmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/capture"
	capturescmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/captures"
	replaycmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/replay"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	"github.com/spf13/cobra"
)

func TestRootCommandShowsHelpByDefault(t *testing.T) {
	rootCmd := newTestRootCommand(t)
	var output bytes.Buffer

	rootCmd.SetOut(&output)
	rootCmd.SetErr(&output)
	rootCmd.SetArgs([]string{})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("expected command to succeed, got error: %v", err)
	}

	out := output.String()
	if !strings.Contains(out, "capture") || !strings.Contains(out, "captures") || !strings.Contains(out, "replay") {
		t.Fatalf("expected default help output to include capture commands and replay, got %q", out)
	}
}

func TestRootCommandVersionFlag(t *testing.T) {
	rootCmd := newTestRootCommand(t)
	var output bytes.Buffer

	rootCmd.SetOut(&output)
	rootCmd.SetErr(&output)
	rootCmd.SetArgs([]string{"--version"})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("expected --version to succeed, got error: %v", err)
	}

	if got, want := output.String(), "test-version\n"; got != want {
		t.Fatalf("expected version output %q, got %q", want, got)
	}
}

func TestCapturesListCommandReadsConfiguredStore(t *testing.T) {
	capturesDir := t.TempDir()
	store, err := jsonc.NewStore(capturesDir, nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	record := testCommandCapture("aabbccdd-0000-0000-0000-000000000000", domain.ProviderGitHub)
	if _, err := store.Save(context.Background(), record); err != nil {
		t.Fatalf("seed capture: %v", err)
	}

	configPath := writeCommandTestConfig(t, capturesDir)
	rootCmd := newTestRootCommand(t)
	var out bytes.Buffer
	rootCmd.SetOut(&out)
	rootCmd.SetErr(&out)
	rootCmd.SetArgs([]string{"--config", configPath, "captures", "list", "--limit", "10"})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("execute captures list: %v", err)
	}

	output := out.String()
	if !strings.Contains(output, "Captured webhooks:") {
		t.Fatalf("expected list output header, got %q", output)
	}
	if !strings.Contains(output, "[github]") {
		t.Fatalf("expected provider output, got %q", output)
	}
}

func TestCapturesDeleteCommandDeletesByPrefix(t *testing.T) {
	capturesDir := t.TempDir()
	store, err := jsonc.NewStore(capturesDir, nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	record := testCommandCapture("deadbeef-0000-0000-0000-000000000000", domain.ProviderUnknown)
	if _, err := store.Save(context.Background(), record); err != nil {
		t.Fatalf("seed capture: %v", err)
	}

	configPath := writeCommandTestConfig(t, capturesDir)
	rootCmd := newTestRootCommand(t)
	var out bytes.Buffer
	rootCmd.SetOut(&out)
	rootCmd.SetErr(&out)
	rootCmd.SetArgs([]string{"--config", configPath, "captures", "delete", "--force", "deadbeef"})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("execute captures delete: %v", err)
	}
	if !strings.Contains(out.String(), "Deleted capture deadbeef") {
		t.Fatalf("expected delete confirmation output, got %q", out.String())
	}
	if _, err := store.ResolveByIDOrPrefix(context.Background(), record.ID); err == nil {
		t.Fatalf("expected capture to be deleted")
	}
}

func TestCapturesDeleteCommandMapsNotFoundError(t *testing.T) {
	configPath := writeCommandTestConfig(t, t.TempDir())
	rootCmd := newTestRootCommand(t)
	rootCmd.SetOut(&bytes.Buffer{})
	rootCmd.SetErr(&bytes.Buffer{})
	rootCmd.SetArgs([]string{"--config", configPath, "captures", "delete", "--force", "does-not-exist"})

	err := rootCmd.Execute()
	if err == nil {
		t.Fatalf("expected delete command to fail for missing capture")
	}
	if !strings.Contains(err.Error(), "capture not found") {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func TestReplayCommandReplaysCaptureByPrefix(t *testing.T) {
	capturesDir := t.TempDir()
	store, err := jsonc.NewStore(capturesDir, nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	record := testCommandCapture("beadfeed-0000-0000-0000-000000000000", domain.ProviderGitHub)
	record.URL = "/webhooks/test?attempt=1"
	record.Path = "/webhooks/test"
	record.Headers = append(record.Headers,
		domain.HeaderEntry{Key: "X-GitHub-Event", Value: "push"},
		domain.HeaderEntry{Key: "X-Hub-Signature-256", Value: "sha256=abc"},
	)
	if _, err := store.Save(context.Background(), record); err != nil {
		t.Fatalf("seed capture: %v", err)
	}

	var receivedPath string
	var receivedMethod string
	var receivedBody string
	var githubEvent string
	targetServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		bodyBytes, readErr := io.ReadAll(req.Body)
		if readErr != nil {
			t.Fatalf("read replay request body: %v", readErr)
		}
		receivedPath = req.URL.RequestURI()
		receivedMethod = req.Method
		receivedBody = string(bodyBytes)
		githubEvent = req.Header.Get("X-GitHub-Event")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer targetServer.Close()

	configPath := writeCommandTestConfig(t, capturesDir)
	rootCmd := newTestRootCommand(t)
	var out bytes.Buffer
	rootCmd.SetOut(&out)
	rootCmd.SetErr(&out)
	rootCmd.SetArgs([]string{"--config", configPath, "replay", "beadfeed", "--base-url", targetServer.URL})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("execute replay command: %v", err)
	}
	if receivedPath != "/webhooks/test?attempt=1" {
		t.Fatalf("expected replay path with query, got %q", receivedPath)
	}
	if receivedMethod != "POST" {
		t.Fatalf("expected replay method POST, got %q", receivedMethod)
	}
	if strings.TrimSpace(receivedBody) != `{"ok":true}` {
		t.Fatalf("expected replay body to match capture, got %q", receivedBody)
	}
	if githubEvent != "push" {
		t.Fatalf("expected GitHub header to be preserved, got %q", githubEvent)
	}

	output := out.String()
	if !strings.Contains(output, "Status: 201 Created") {
		t.Fatalf("expected replay status output, got %q", output)
	}
	if !strings.Contains(output, "Duration:") {
		t.Fatalf("expected replay duration output, got %q", output)
	}
}

func TestReplayCommandMapsNotFoundError(t *testing.T) {
	configPath := writeCommandTestConfig(t, t.TempDir())
	rootCmd := newTestRootCommand(t)
	rootCmd.SetOut(&bytes.Buffer{})
	rootCmd.SetErr(&bytes.Buffer{})
	rootCmd.SetArgs([]string{"--config", configPath, "replay", "missing", "http://localhost:9999"})

	err := rootCmd.Execute()
	if err == nil {
		t.Fatalf("expected replay command to fail for missing capture")
	}
	if !strings.Contains(err.Error(), "capture not found") {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func newTestRootCommand(t *testing.T) *cobra.Command {
	t.Helper()
	return NewCommand(Dependencies{
		Version:      "test-version",
		ConfigLoader: configtoml.NewLoader(),
		CaptureDependencies: capturecmd.Dependencies{
			ServiceFactory: func(capturesDir string) (*appcapture.Service, error) {
				store, err := jsonc.NewStore(capturesDir, nil, nil)
				if err != nil {
					return nil, err
				}
				detector := provider.NewRegistry(
					githubdetector.NewDetector(),
				)
				return appcapture.NewService(store, detector, nil, "test-version"), nil
			},
			ServerFactory: httpcapture.NewServer,
		},
		CapturesDependencies: capturescmd.Dependencies{
			ServiceFactory: func(capturesDir string) (*appcaptures.Service, error) {
				store, err := jsonc.NewStore(capturesDir, nil, nil)
				if err != nil {
					return nil, err
				}
				return appcaptures.NewService(store), nil
			},
		},
		ReplayDependencies: replaycmd.Dependencies{
			ServiceFactory: func(capturesDir string) (*appreplay.Service, error) {
				store, err := jsonc.NewStore(capturesDir, nil, nil)
				if err != nil {
					return nil, err
				}
				dispatcher := httpreplay.NewClient(&http.Client{})
				return appreplay.NewService(store, dispatcher), nil
			},
		},
	})
}

func writeCommandTestConfig(t *testing.T, capturesDir string) string {
	t.Helper()
	configPath := filepath.Join(t.TempDir(), "config.toml")
	normalizedCapturesDir := filepath.ToSlash(capturesDir)
	content := `captures_dir = "` + normalizedCapturesDir + `"
log_level = "info"
`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write command test config: %v", err)
	}
	return configPath
}

func testCommandCapture(id string, providerName string) domain.CaptureRecord {
	now := time.Date(2026, time.February, 21, 13, 0, 0, 0, time.UTC).Format(time.RFC3339Nano)
	body := []byte(`{"ok":true}`)
	return domain.CaptureRecord{
		ID:            id,
		Timestamp:     now,
		Method:        "POST",
		URL:           "/webhooks/test",
		Path:          "/webhooks/test",
		Headers:       []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		ContentType:   "application/json",
		ContentLength: int64(len(body)),
		RawBodyBase64: base64.StdEncoding.EncodeToString(body),
		Provider:      providerName,
		Meta: domain.CaptureMeta{
			StoredAt:           now,
			BodyEncoding:       domain.BodyEncodingBase64,
			CaptureToolVersion: "test",
		},
	}
}
