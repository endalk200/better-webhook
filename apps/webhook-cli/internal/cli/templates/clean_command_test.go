package templates

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"testing"
	"time"

	templatestore "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/storage/template"
	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	platformtime "github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/time"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/testutil"
)

func TestCleanCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newCleanCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected clean command to reject positional args")
	}
}

type fakeTemplatePrompter struct {
	confirmed bool
	err       error
	called    int
}

func (p *fakeTemplatePrompter) Confirm(prompt string, _ io.Reader, out io.Writer) (bool, error) {
	p.called++
	if out != nil {
		_, _ = fmt.Fprintf(out, "%s [y/N]: ", prompt)
	}
	if p.err != nil {
		return false, p.err
	}
	return p.confirmed, nil
}

func TestCleanCommandCancelledByPromptKeepsTemplates(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")
	prompter := &fakeTemplatePrompter{confirmed: false}

	cmd := newCleanCommand(Dependencies{
		ServiceFactory: testTemplateServiceFactory(t),
		Prompter:       prompter,
	})
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)
	cmd.SetIn(strings.NewReader("unused\n"))
	cmd.SetArgs([]string{"--templates-dir", templatesDir})
	testutil.InitializeRuntimeConfig(t, cmd, runtime.AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: templatesDir,
		LogLevel:     runtime.LogLevelInfo,
	})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute clean command: %v", err)
	}
	if prompter.called != 1 {
		t.Fatalf("expected prompter to be called once, got %d", prompter.called)
	}
	if !strings.Contains(output.String(), "Delete all 1 template(s)?") {
		t.Fatalf("expected prompt output, got %q", output.String())
	}
	if !strings.Contains(output.String(), "Cancelled.") {
		t.Fatalf("expected cancellation output, got %q", output.String())
	}

	store, err := templatestore.NewStore(templatesDir)
	if err != nil {
		t.Fatalf("create local template store: %v", err)
	}
	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list local templates: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected template to remain after cancellation, got %d", len(items))
	}
}

func TestCleanCommandForceSkipsPromptAndDeletesTemplates(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")
	prompter := &fakeTemplatePrompter{err: errors.New("prompter should not be called")}

	cmd := newCleanCommand(Dependencies{
		ServiceFactory: testTemplateServiceFactory(t),
		Prompter:       prompter,
	})
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)
	cmd.SetArgs([]string{"--templates-dir", templatesDir, "--force"})
	testutil.InitializeRuntimeConfig(t, cmd, runtime.AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: templatesDir,
		LogLevel:     runtime.LogLevelInfo,
	})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute clean command: %v", err)
	}
	if prompter.called != 0 {
		t.Fatalf("expected --force to skip prompt, got %d calls", prompter.called)
	}
	if !strings.Contains(output.String(), "Removed 1 template(s)") {
		t.Fatalf("expected clean success output, got %q", output.String())
	}

	store, err := templatestore.NewStore(templatesDir)
	if err != nil {
		t.Fatalf("create local template store: %v", err)
	}
	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list local templates: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected templates to be deleted, got %d", len(items))
	}
}

func TestCleanCommandReturnsPromptError(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")
	prompter := &fakeTemplatePrompter{err: errors.New("prompt failed")}

	cmd := newCleanCommand(Dependencies{
		ServiceFactory: testTemplateServiceFactory(t),
		Prompter:       prompter,
	})
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetErr(&bytes.Buffer{})
	cmd.SetArgs([]string{"--templates-dir", templatesDir})
	testutil.InitializeRuntimeConfig(t, cmd, runtime.AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: templatesDir,
		LogLevel:     runtime.LogLevelInfo,
	})

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected clean command to return prompt error")
	}
	if !strings.Contains(err.Error(), "prompt failed") {
		t.Fatalf("expected prompt error to be returned, got %v", err)
	}
}

func TestCleanCommandReturnsErrorWhenPrompterIsNilWithoutForce(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")

	cmd := newCleanCommand(Dependencies{
		ServiceFactory: testTemplateServiceFactory(t),
		Prompter:       nil,
	})
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetErr(&bytes.Buffer{})
	cmd.SetArgs([]string{"--templates-dir", templatesDir})
	testutil.InitializeRuntimeConfig(t, cmd, runtime.AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: templatesDir,
		LogLevel:     runtime.LogLevelInfo,
	})

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected clean command to return missing prompter error")
	}
	if !strings.Contains(err.Error(), "templates prompter cannot be nil") {
		t.Fatalf("expected missing prompter error, got %v", err)
	}
}

func TestCleanCommandAllowsNilPrompterWithForce(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")

	cmd := newCleanCommand(Dependencies{
		ServiceFactory: testTemplateServiceFactory(t),
		Prompter:       nil,
	})
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)
	cmd.SetArgs([]string{"--templates-dir", templatesDir, "--force"})
	testutil.InitializeRuntimeConfig(t, cmd, runtime.AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: templatesDir,
		LogLevel:     runtime.LogLevelInfo,
	})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("expected force clean to succeed without prompter, got %v", err)
	}
	if !strings.Contains(output.String(), "Removed 1 template(s)") {
		t.Fatalf("expected clean success output, got %q", output.String())
	}
}

type noOpRemoteTemplateSource struct{}

func (noOpRemoteTemplateSource) FetchIndex(context.Context) (domain.TemplatesIndex, error) {
	return domain.TemplatesIndex{}, errors.New("not implemented")
}

func (noOpRemoteTemplateSource) FetchTemplate(context.Context, string) (domain.WebhookTemplate, error) {
	return domain.WebhookTemplate{}, errors.New("not implemented")
}

func testTemplateServiceFactory(t *testing.T) ServiceFactory {
	t.Helper()
	return func(templatesDir string) (*apptemplates.Service, error) {
		localStore, err := templatestore.NewStore(templatesDir)
		if err != nil {
			return nil, err
		}
		cacheStore, err := templatestore.NewCache(filepath.Join(templatesDir, ".index-cache.json"))
		if err != nil {
			return nil, err
		}
		return apptemplates.NewService(
			localStore,
			noOpRemoteTemplateSource{},
			cacheStore,
			platformtime.SystemClock{},
		), nil
	}
}

func seedLocalTemplateForCleanTest(t *testing.T, templatesDir string, id string) {
	t.Helper()
	store, err := templatestore.NewStore(templatesDir)
	if err != nil {
		t.Fatalf("create local template store: %v", err)
	}

	downloadedAt := time.Date(2026, time.February, 24, 12, 0, 0, 0, time.UTC).Format(time.RFC3339Nano)
	templateFile := fmt.Sprintf("github/%s.jsonc", id)
	if _, err := store.Save(context.Background(), domain.TemplateMetadata{
		ID:       id,
		Name:     id,
		Provider: "github",
		Event:    "push",
		File:     templateFile,
	}, domain.WebhookTemplate{
		Method:   "POST",
		Provider: "github",
		Event:    "push",
		Body:     json.RawMessage(`{"ok":true}`),
	}, downloadedAt); err != nil {
		t.Fatalf("seed local template: %v", err)
	}
}
