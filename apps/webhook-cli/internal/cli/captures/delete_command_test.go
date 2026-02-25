package captures

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/storage/jsonc"
	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/captures"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
)

type fakePrompter struct {
	confirmed bool
	err       error
	called    int
	prompt    string
}

func (p *fakePrompter) Confirm(prompt string, _ io.Reader, _ io.Writer) (bool, error) {
	p.called++
	p.prompt = prompt
	if p.err != nil {
		return false, p.err
	}
	return p.confirmed, nil
}

func TestDeleteCommandPromptCancellationKeepsCapture(t *testing.T) {
	capturesDir := t.TempDir()
	store := seedCaptureForDeleteTest(t, capturesDir, "deadbeef-0000-0000-0000-000000000000")
	prompter := &fakePrompter{confirmed: false}

	cmd := newDeleteCommand(Dependencies{
		ServiceFactory: testCapturesServiceFactory(t),
		Prompter:       prompter,
	})
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)
	cmd.SetIn(strings.NewReader("unused\n"))
	cmd.SetArgs([]string{"--captures-dir", capturesDir, "deadbeef"})
	initializeCapturesRuntimeConfig(t, cmd, capturesDir)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute delete command: %v", err)
	}
	if prompter.called != 1 {
		t.Fatalf("expected prompter to be called once, got %d", prompter.called)
	}
	if !strings.Contains(prompter.prompt, "POST") || !strings.Contains(prompter.prompt, "/webhooks/test") {
		t.Fatalf("expected prompt to include request context, got %q", prompter.prompt)
	}
	if !strings.Contains(output.String(), "Cancelled.") {
		t.Fatalf("expected cancellation output, got %q", output.String())
	}
	if _, err := store.ResolveByIDOrPrefix(context.Background(), "deadbeef"); err != nil {
		t.Fatalf("expected capture to remain after cancellation: %v", err)
	}
}

func TestDeleteCommandForceSkipsPromptAndDeletesCapture(t *testing.T) {
	capturesDir := t.TempDir()
	store := seedCaptureForDeleteTest(t, capturesDir, "facefeed-0000-0000-0000-000000000000")
	prompter := &fakePrompter{err: errors.New("prompter should not be called")}

	cmd := newDeleteCommand(Dependencies{
		ServiceFactory: testCapturesServiceFactory(t),
		Prompter:       prompter,
	})
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)
	cmd.SetArgs([]string{"--captures-dir", capturesDir, "--force", "facefeed"})
	initializeCapturesRuntimeConfig(t, cmd, capturesDir)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute delete command: %v", err)
	}
	if prompter.called != 0 {
		t.Fatalf("expected --force to skip prompt, got %d calls", prompter.called)
	}
	if !strings.Contains(output.String(), "Deleted capture facefeed") {
		t.Fatalf("expected successful delete output, got %q", output.String())
	}
	if _, err := store.ResolveByIDOrPrefix(context.Background(), "facefeed"); err == nil {
		t.Fatalf("expected capture to be deleted")
	}
}

func TestDeleteCommandReturnsPromptError(t *testing.T) {
	capturesDir := t.TempDir()
	_ = seedCaptureForDeleteTest(t, capturesDir, "cafefeed-0000-0000-0000-000000000000")
	prompter := &fakePrompter{err: errors.New("prompt failed")}

	cmd := newDeleteCommand(Dependencies{
		ServiceFactory: testCapturesServiceFactory(t),
		Prompter:       prompter,
	})
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetErr(&bytes.Buffer{})
	cmd.SetArgs([]string{"--captures-dir", capturesDir, "cafefeed"})
	initializeCapturesRuntimeConfig(t, cmd, capturesDir)

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected delete command to return prompt error")
	}
	if !strings.Contains(err.Error(), "prompt failed") {
		t.Fatalf("expected prompt error to be returned, got %v", err)
	}
}

func testCapturesServiceFactory(t *testing.T) ServiceFactory {
	t.Helper()
	return func(capturesDir string) (*appcaptures.Service, error) {
		store, err := jsonc.NewStore(capturesDir, nil, nil)
		if err != nil {
			return nil, err
		}
		return appcaptures.NewService(store), nil
	}
}

func seedCaptureForDeleteTest(t *testing.T, capturesDir string, id string) *jsonc.Store {
	t.Helper()

	store, err := jsonc.NewStore(capturesDir, nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	now := time.Date(2026, time.February, 24, 12, 0, 0, 0, time.UTC).Format(time.RFC3339Nano)
	body := []byte(`{"ok":true}`)
	record := domain.CaptureRecord{
		ID:            id,
		Timestamp:     now,
		Method:        "POST",
		URL:           "/webhooks/test",
		Path:          "/webhooks/test",
		Headers:       []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		ContentType:   "application/json",
		ContentLength: int64(len(body)),
		RawBodyBase64: base64.StdEncoding.EncodeToString(body),
		Provider:      domain.ProviderGitHub,
		Meta: domain.CaptureMeta{
			StoredAt:           now,
			BodyEncoding:       domain.BodyEncodingBase64,
			CaptureToolVersion: "test",
		},
	}
	if _, err := store.Save(context.Background(), record); err != nil {
		t.Fatalf("seed capture: %v", err)
	}

	return store
}

type staticConfigLoader struct {
	config runtime.AppConfig
}

func (l staticConfigLoader) Load(_ string) (runtime.AppConfig, error) {
	return l.config, nil
}

func initializeCapturesRuntimeConfig(t *testing.T, cmd *cobra.Command, capturesDir string) {
	t.Helper()
	if err := runtime.InitializeConfig(cmd, staticConfigLoader{
		config: runtime.AppConfig{
			CapturesDir:  capturesDir,
			TemplatesDir: t.TempDir(),
			LogLevel:     runtime.LogLevelInfo,
		},
	}); err != nil {
		t.Fatalf("initialize runtime config: %v", err)
	}
}
