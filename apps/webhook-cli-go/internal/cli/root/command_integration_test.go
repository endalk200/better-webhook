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
	"sync/atomic"
	"testing"
	"time"

	"github.com/spf13/cobra"

	configtoml "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/config/toml"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/provider"
	githubdetector "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/provider/github"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/storage/jsonc"
	templatestore "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/storage/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/transport/httpcapture"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/transport/httpreplay"
	httptemplaterun "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/transport/httptemplaterun"
	httptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/transport/httptemplates"
	appcapture "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/capture"
	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/captures"
	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/replay"
	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/templates"
	capturecmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/capture"
	capturescmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/captures"
	replaycmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/replay"
	templatescmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	platformtime "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/time"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/testutil"
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
	if !strings.Contains(out, "capture") || !strings.Contains(out, "captures") {
		t.Fatalf("expected default help output to include capture commands, got %q", out)
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

	type receivedReplayRequest struct {
		Path        string
		Method      string
		Body        string
		GitHubEvent string
	}
	receivedRequestCh := make(chan receivedReplayRequest, 1)
	handlerErrCh := make(chan error, 1)
	targetServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		bodyBytes, readErr := io.ReadAll(req.Body)
		if readErr != nil {
			select {
			case handlerErrCh <- readErr:
			default:
			}
			http.Error(w, "read error", http.StatusInternalServerError)
			return
		}
		select {
		case receivedRequestCh <- receivedReplayRequest{
			Path:        req.URL.RequestURI(),
			Method:      req.Method,
			Body:        string(bodyBytes),
			GitHubEvent: req.Header.Get("X-GitHub-Event"),
		}:
		default:
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer targetServer.Close()

	configPath := writeCommandTestConfig(t, capturesDir)
	rootCmd := newTestRootCommand(t)
	var out bytes.Buffer
	rootCmd.SetOut(&out)
	rootCmd.SetErr(&out)
	rootCmd.SetArgs([]string{"--config", configPath, "captures", "replay", "beadfeed", "--base-url", targetServer.URL})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("execute replay command: %v", err)
	}
	select {
	case handlerErr := <-handlerErrCh:
		t.Fatalf("replay target handler error: %v", handlerErr)
	default:
	}

	select {
	case received := <-receivedRequestCh:
		if received.Path != "/webhooks/test?attempt=1" {
			t.Fatalf("expected replay path with query, got %q", received.Path)
		}
		if received.Method != "POST" {
			t.Fatalf("expected replay method POST, got %q", received.Method)
		}
		if strings.TrimSpace(received.Body) != `{"ok":true}` {
			t.Fatalf("expected replay body to match capture, got %q", received.Body)
		}
		if received.GitHubEvent != "push" {
			t.Fatalf("expected GitHub header to be preserved, got %q", received.GitHubEvent)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for replay request")
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
	rootCmd.SetArgs([]string{"--config", configPath, "captures", "replay", "missing", "http://localhost:9999"})

	err := rootCmd.Execute()
	if err == nil {
		t.Fatalf("expected replay command to fail for missing capture")
	}
	if !strings.Contains(err.Error(), "capture not found") {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func TestTemplatesListCommandFromRemote(t *testing.T) {
	configPath := writeCommandTestConfig(t, t.TempDir())
	templatesDir := t.TempDir()
	rootCmd := newTestRootCommand(t)
	var out bytes.Buffer
	rootCmd.SetOut(&out)
	rootCmd.SetErr(&out)
	rootCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "list",
		"--templates-dir", templatesDir,
	})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("execute templates list: %v", err)
	}
	output := out.String()
	if !strings.Contains(output, "Available templates:") {
		t.Fatalf("expected templates list output, got %q", output)
	}
	if !strings.Contains(output, "github-push") {
		t.Fatalf("expected github-push template in list output, got %q", output)
	}
}

func TestTemplatesDownloadLocalSearchCleanAndCache(t *testing.T) {
	configPath := writeCommandTestConfig(t, t.TempDir())
	templatesDir := t.TempDir()

	downloadCmd := newTestRootCommand(t)
	var downloadOut bytes.Buffer
	downloadCmd.SetOut(&downloadOut)
	downloadCmd.SetErr(&downloadOut)
	downloadCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "download", "github-push",
		"--templates-dir", templatesDir,
	})
	if err := downloadCmd.Execute(); err != nil {
		t.Fatalf("execute templates download: %v", err)
	}
	if !strings.Contains(downloadOut.String(), "Downloaded template github-push") {
		t.Fatalf("expected download output, got %q", downloadOut.String())
	}

	localCmd := newTestRootCommand(t)
	var localOut bytes.Buffer
	localCmd.SetOut(&localOut)
	localCmd.SetErr(&localOut)
	localCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "local",
		"--templates-dir", templatesDir,
	})
	if err := localCmd.Execute(); err != nil {
		t.Fatalf("execute templates local: %v", err)
	}
	if !strings.Contains(localOut.String(), "github-push") {
		t.Fatalf("expected local template output, got %q", localOut.String())
	}

	searchCmd := newTestRootCommand(t)
	var searchOut bytes.Buffer
	searchCmd.SetOut(&searchOut)
	searchCmd.SetErr(&searchOut)
	searchCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "search", "push",
		"--templates-dir", templatesDir,
	})
	if err := searchCmd.Execute(); err != nil {
		t.Fatalf("execute templates search: %v", err)
	}
	if !strings.Contains(searchOut.String(), "Search results for \"push\":") {
		t.Fatalf("expected search output, got %q", searchOut.String())
	}

	cleanCmd := newTestRootCommand(t)
	var cleanOut bytes.Buffer
	cleanCmd.SetOut(&cleanOut)
	cleanCmd.SetErr(&cleanOut)
	cleanCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "clean", "--force",
		"--templates-dir", templatesDir,
	})
	if err := cleanCmd.Execute(); err != nil {
		t.Fatalf("execute templates clean: %v", err)
	}
	if !strings.Contains(cleanOut.String(), "Removed 1 template(s)") {
		t.Fatalf("expected clean output, got %q", cleanOut.String())
	}

	cacheCmd := newTestRootCommand(t)
	var cacheOut bytes.Buffer
	cacheCmd.SetOut(&cacheOut)
	cacheCmd.SetErr(&cacheOut)
	cacheCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "cache", "clear",
		"--templates-dir", templatesDir,
	})
	if err := cacheCmd.Execute(); err != nil {
		t.Fatalf("execute templates cache clear: %v", err)
	}
	if !strings.Contains(cacheOut.String(), "Template cache cleared.") {
		t.Fatalf("expected cache clear output, got %q", cacheOut.String())
	}
}

func TestTemplatesRunCommandGeneratesGitHubSignature(t *testing.T) {
	type receivedTemplateRunRequest struct {
		Body      []byte
		Signature string
	}
	receiverCh := make(chan receivedTemplateRunRequest, 1)
	receiverServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, _ := io.ReadAll(req.Body)
		receiverCh <- receivedTemplateRunRequest{
			Body:      body,
			Signature: req.Header.Get("X-Hub-Signature-256"),
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer receiverServer.Close()

	templateServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.URL.Path {
		case "/templates/templates.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
  "version":"1.0.0",
  "templates":[
    {
      "id":"github-push",
      "name":"GitHub Push",
      "provider":"github",
      "event":"push",
      "file":"github/github-push.jsonc"
    }
  ]
}`))
		case "/templates/github/github-push.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
  "method":"POST",
  "provider":"github",
  "headers":[
    {"key":"Content-Type","value":"application/json"},
    {"key":"X-Hub-Signature-256","value":"$github:x-hub-signature-256"}
  ],
  "body":{"ok":true}
}`))
		default:
			http.NotFound(w, req)
		}
	}))
	defer templateServer.Close()

	configPath := writeCommandTestConfig(t, t.TempDir())
	templatesDir := t.TempDir()
	downloadCmd := newTestRootCommandWithTemplateRemote(t, templateServer.URL, templateServer.Client())
	downloadCmd.SetOut(&bytes.Buffer{})
	downloadCmd.SetErr(&bytes.Buffer{})
	downloadCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "download", "github-push",
		"--templates-dir", templatesDir,
	})
	if err := downloadCmd.Execute(); err != nil {
		t.Fatalf("execute templates download: %v", err)
	}

	runCmd := newTestRootCommandWithTemplateRemote(t, templateServer.URL, templateServer.Client())
	var runOut bytes.Buffer
	runCmd.SetOut(&runOut)
	runCmd.SetErr(&runOut)
	runCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "run", "github-push", receiverServer.URL,
		"--templates-dir", templatesDir,
		"--secret", "integration-secret",
	})
	if err := runCmd.Execute(); err != nil {
		t.Fatalf("execute templates run: %v", err)
	}
	select {
	case received := <-receiverCh:
		expectedSignature := testutil.ComputeSignatureHex(received.Body, "integration-secret")
		if received.Signature != expectedSignature {
			t.Fatalf("signature mismatch: got %q want %q", received.Signature, expectedSignature)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for templates run request")
	}

	if !strings.Contains(runOut.String(), "Executed template github-push [github] POST ->") {
		t.Fatalf("expected run output, got %q", runOut.String())
	}
}

func TestTemplatesDownloadAllHonorsRefreshFlag(t *testing.T) {
	var indexRequests int32
	templateServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.URL.Path {
		case "/templates/templates.jsonc":
			atomic.AddInt32(&indexRequests, 1)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
  "version":"1.0.0",
  "templates":[
    {
      "id":"github-push",
      "name":"GitHub Push",
      "provider":"github",
      "event":"push",
      "file":"github/github-push.jsonc"
    }
  ]
}`))
		case "/templates/github/github-push.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"method":"POST","body":{"ok":true}}`))
		default:
			http.NotFound(w, req)
		}
	}))
	defer templateServer.Close()

	configPath := writeCommandTestConfig(t, t.TempDir())
	templatesDir := t.TempDir()

	listCmd := newTestRootCommandWithTemplateRemote(t, templateServer.URL, templateServer.Client())
	listCmd.SetOut(&bytes.Buffer{})
	listCmd.SetErr(&bytes.Buffer{})
	listCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "list",
		"--templates-dir", templatesDir,
	})
	if err := listCmd.Execute(); err != nil {
		t.Fatalf("execute templates list: %v", err)
	}
	if got := atomic.LoadInt32(&indexRequests); got != 1 {
		t.Fatalf("expected one index request after list, got %d", got)
	}

	downloadCmd := newTestRootCommandWithTemplateRemote(t, templateServer.URL, templateServer.Client())
	downloadCmd.SetOut(&bytes.Buffer{})
	downloadCmd.SetErr(&bytes.Buffer{})
	downloadCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "download", "--all",
		"--templates-dir", templatesDir,
	})
	if err := downloadCmd.Execute(); err != nil {
		t.Fatalf("execute templates download --all: %v", err)
	}
	if got := atomic.LoadInt32(&indexRequests); got != 1 {
		t.Fatalf("expected download --all without --refresh to use cache, got %d index requests", got)
	}

	refreshCmd := newTestRootCommandWithTemplateRemote(t, templateServer.URL, templateServer.Client())
	refreshCmd.SetOut(&bytes.Buffer{})
	refreshCmd.SetErr(&bytes.Buffer{})
	refreshCmd.SetArgs([]string{
		"--config", configPath,
		"templates", "download", "--all", "--refresh",
		"--templates-dir", templatesDir,
	})
	if err := refreshCmd.Execute(); err != nil {
		t.Fatalf("execute templates download --all --refresh: %v", err)
	}
	if got := atomic.LoadInt32(&indexRequests); got != 2 {
		t.Fatalf("expected --refresh to force second index request, got %d", got)
	}
}

func newTestRootCommand(t *testing.T) *cobra.Command {
	t.Helper()
	templateServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.URL.Path {
		case "/templates/templates.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
  "version":"1.0.0",
  "templates":[
    {
      "id":"github-push",
      "name":"GitHub Push",
      "provider":"github",
      "event":"push",
      "file":"github/github-push.jsonc"
    },
    {
      "id":"github-issues",
      "name":"GitHub Issues",
      "provider":"github",
      "event":"issues",
      "file":"github/github-issues.jsonc"
    }
  ]
}`))
		case "/templates/github/github-push.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"method":"POST","headers":[{"key":"X-GitHub-Event","value":"push"}],"body":{"ok":true}}`))
		case "/templates/github/github-issues.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"method":"POST","headers":[{"key":"X-GitHub-Event","value":"issues"}],"body":{"ok":true}}`))
		default:
			http.NotFound(w, req)
		}
	}))
	t.Cleanup(templateServer.Close)

	return newTestRootCommandWithTemplateRemote(t, templateServer.URL, templateServer.Client())
}

func newTestRootCommandWithTemplateRemote(
	t *testing.T,
	templateBaseURL string,
	templateHTTPClient *http.Client,
) *cobra.Command {
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
			ReplayDependencies: replaycmd.Dependencies{
				ServiceFactory: func(capturesDir string) (*appreplay.Service, error) {
					store, err := jsonc.NewStore(capturesDir, nil, nil)
					if err != nil {
						return nil, err
					}
					dispatcher := httpreplay.NewClient(&http.Client{Timeout: httptemplates.DefaultHTTPTimeout})
					return appreplay.NewService(store, dispatcher), nil
				},
			},
		},
		TemplateDependencies: templatescmd.Dependencies{
			ServiceFactory: func(templatesDir string) (*apptemplates.Service, error) {
				localStore, err := templatestore.NewStore(templatesDir)
				if err != nil {
					return nil, err
				}
				cacheStore, err := templatestore.NewCache(filepath.Join(templatesDir, ".index-cache.json"))
				if err != nil {
					return nil, err
				}
				remoteStore, err := httptemplates.NewClient(httptemplates.ClientOptions{
					BaseURL:    templateBaseURL,
					HTTPClient: templateHTTPClient,
				})
				if err != nil {
					return nil, err
				}
				dispatcher := httptemplaterun.NewDispatcher(
					httpreplay.NewClient(&http.Client{Timeout: httptemplates.DefaultHTTPTimeout}),
				)
				return apptemplates.NewService(
					localStore,
					remoteStore,
					cacheStore,
					platformtime.SystemClock{},
					apptemplates.WithDispatcher(dispatcher),
				), nil
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
