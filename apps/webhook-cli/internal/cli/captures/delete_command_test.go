package captures

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/storage/jsonc"
	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/captures"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/testutil"
)

type fakePrompter struct {
	confirmed bool
	err       error
	called    int
	prompt    string
}

func (p *fakePrompter) Confirm(prompt string, _ io.Reader, out io.Writer) (bool, error) {
	p.called++
	p.prompt = prompt
	if out != nil {
		_, _ = fmt.Fprintf(out, "%s [y/N]: ", prompt)
	}
	if p.err != nil {
		return false, p.err
	}
	return p.confirmed, nil
}

func TestDeleteCommandPromptCancellationKeepsCapture(t *testing.T) {
	capturesDir := t.TempDir()
	store := seedCaptureForDeleteTest(t, capturesDir, "deadbeef-0000-0000-0000-000000000000")
	prompter := &fakePrompter{confirmed: false}

	cmd, outBuf, errBuf := setupDeleteCmd(
		t,
		capturesDir,
		prompter,
		strings.NewReader("unused\n"),
		"--captures-dir",
		capturesDir,
		"deadbeef",
	)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute delete command: %v", err)
	}
	if prompter.called != 1 {
		t.Fatalf("expected prompter to be called once, got %d", prompter.called)
	}
	if !strings.Contains(prompter.prompt, "POST") || !strings.Contains(prompter.prompt, "/webhooks/test") {
		t.Fatalf("expected prompt to include request context, got %q", prompter.prompt)
	}
	if !strings.Contains(errBuf.String(), "Delete capture deadbeef") {
		t.Fatalf("expected prompt on stderr, got %q", errBuf.String())
	}
	if !strings.Contains(outBuf.String(), "Cancelled.") {
		t.Fatalf("expected cancellation output on stdout, got %q", outBuf.String())
	}
	if _, err := store.ResolveByIDOrPrefix(context.Background(), "deadbeef"); err != nil {
		t.Fatalf("expected capture to remain after cancellation: %v", err)
	}
}

func TestDeleteCommandForceSkipsPromptAndDeletesCapture(t *testing.T) {
	capturesDir := t.TempDir()
	store := seedCaptureForDeleteTest(t, capturesDir, "facefeed-0000-0000-0000-000000000000")
	prompter := &fakePrompter{err: errors.New("prompter should not be called")}

	cmd, outBuf, errBuf := setupDeleteCmd(
		t,
		capturesDir,
		prompter,
		nil,
		"--captures-dir",
		capturesDir,
		"--force",
		"facefeed",
	)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute delete command: %v", err)
	}
	if prompter.called != 0 {
		t.Fatalf("expected --force to skip prompt, got %d calls", prompter.called)
	}
	if !strings.Contains(outBuf.String(), "Deleted capture facefeed") {
		t.Fatalf("expected successful delete output, got %q", outBuf.String())
	}
	if errBuf.Len() != 0 {
		t.Fatalf("expected no stderr output for --force success, got %q", errBuf.String())
	}
	if _, err := store.ResolveByIDOrPrefix(context.Background(), "facefeed"); err == nil {
		t.Fatalf("expected capture to be deleted")
	}
}

func TestDeleteCommandReturnsPromptError(t *testing.T) {
	capturesDir := t.TempDir()
	_ = seedCaptureForDeleteTest(t, capturesDir, "cafefeed-0000-0000-0000-000000000000")
	prompter := &fakePrompter{err: errors.New("prompt failed")}

	cmd, _, _ := setupDeleteCmd(
		t,
		capturesDir,
		prompter,
		nil,
		"--captures-dir",
		capturesDir,
		"cafefeed",
	)

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected delete command to return prompt error")
	}
	if !strings.Contains(err.Error(), "prompt failed") {
		t.Fatalf("expected prompt error to be returned, got %v", err)
	}
}

func TestDeleteCommandReturnsErrorWhenPrompterIsNil(t *testing.T) {
	capturesDir := t.TempDir()
	_ = seedCaptureForDeleteTest(t, capturesDir, "badc0ffe-0000-0000-0000-000000000000")

	cmd, _, _ := setupDeleteCmd(
		t,
		capturesDir,
		nil,
		strings.NewReader("n\n"),
		"--captures-dir",
		capturesDir,
		"badc0ffe",
	)

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected delete command to fail when prompter is nil")
	}
	if !strings.Contains(err.Error(), "captures prompter cannot be nil") {
		t.Fatalf("expected missing prompter error, got %v", err)
	}
}

func TestDeleteCommandAllowsNilPrompterWithForce(t *testing.T) {
	capturesDir := t.TempDir()
	store := seedCaptureForDeleteTest(t, capturesDir, "deafbead-0000-0000-0000-000000000000")

	cmd, outBuf, _ := setupDeleteCmd(
		t,
		capturesDir,
		nil,
		strings.NewReader("n\n"),
		"--captures-dir",
		capturesDir,
		"--force",
		"deafbead",
	)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("expected force delete to succeed without prompter, got %v", err)
	}
	if !strings.Contains(outBuf.String(), "Deleted capture deafbead") {
		t.Fatalf("expected successful delete output, got %q", outBuf.String())
	}
	if _, err := store.ResolveByIDOrPrefix(context.Background(), "deafbead"); err == nil {
		t.Fatalf("expected capture to be deleted")
	}
}

func setupDeleteCmd(
	t *testing.T,
	capturesDir string,
	prompter ui.Prompter,
	input io.Reader,
	args ...string,
) (*cobra.Command, *bytes.Buffer, *bytes.Buffer) {
	t.Helper()

	cmd := newDeleteCommand(Dependencies{
		ServiceFactory: testCapturesServiceFactory(t),
		Prompter:       prompter,
	})
	outBuf := &bytes.Buffer{}
	errBuf := &bytes.Buffer{}
	cmd.SetOut(outBuf)
	cmd.SetErr(errBuf)
	if input != nil {
		cmd.SetIn(input)
	}
	cmd.SetArgs(args)
	testutil.InitializeRuntimeConfig(t, cmd, runtime.AppConfig{
		CapturesDir:  capturesDir,
		TemplatesDir: t.TempDir(),
		LogLevel:     runtime.LogLevelInfo,
	})

	return cmd, outBuf, errBuf
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
