package templates

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/spf13/cobra"

	templatestore "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/storage/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/testutil"
)

func TestDeleteCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newDeleteCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{}); err == nil {
		t.Fatalf("expected delete command to require template id")
	}
	if err := cmd.Args(cmd, []string{"one", "two"}); err == nil {
		t.Fatalf("expected delete command to reject extra args")
	}
}

func TestDeleteCommandCancelledByPromptKeepsTemplate(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")
	prompter := &fakeTemplatePrompter{confirmed: false}

	cmd, output := setupDeleteCmd(
		t,
		templatesDir,
		prompter,
		"--templates-dir",
		templatesDir,
		"github-push",
	)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute delete command: %v", err)
	}
	if prompter.called != 1 {
		t.Fatalf("expected prompter to be called once, got %d", prompter.called)
	}
	if !strings.Contains(output.String(), "Delete template github-push?") {
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

func TestDeleteCommandForceDeletesTemplate(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")
	prompter := &fakeTemplatePrompter{}

	cmd, output := setupDeleteCmd(
		t,
		templatesDir,
		prompter,
		"--templates-dir",
		templatesDir,
		"--force",
		"github-push",
	)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute delete command: %v", err)
	}
	if prompter.called != 0 {
		t.Fatalf("expected --force to skip prompt, got %d calls", prompter.called)
	}
	if !strings.Contains(output.String(), "Deleted template github-push") {
		t.Fatalf("expected delete success output, got %q", output.String())
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
		t.Fatalf("expected template to be deleted, got %d", len(items))
	}
}

func TestDeleteCommandConfirmedByPromptDeletesTemplate(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")
	prompter := &fakeTemplatePrompter{confirmed: true}

	cmd, output := setupDeleteCmd(
		t,
		templatesDir,
		prompter,
		"--templates-dir",
		templatesDir,
		"github-push",
	)

	if err := cmd.Execute(); err != nil {
		t.Fatalf("execute delete command: %v", err)
	}
	if prompter.called != 1 {
		t.Fatalf("expected prompter to be called once, got %d", prompter.called)
	}
	if !strings.Contains(output.String(), "Deleted template github-push") {
		t.Fatalf("expected delete success output, got %q", output.String())
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
		t.Fatalf("expected template to be deleted, got %d", len(items))
	}
}

func TestDeleteCommandReturnsErrorWhenPrompterIsNilWithoutForce(t *testing.T) {
	templatesDir := t.TempDir()
	seedLocalTemplateForCleanTest(t, templatesDir, "github-push")

	cmd, _ := setupDeleteCmd(
		t,
		templatesDir,
		nil,
		"--templates-dir",
		templatesDir,
		"github-push",
	)

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected delete command to return missing prompter error")
	}
	if !strings.Contains(err.Error(), "templates prompter cannot be nil") {
		t.Fatalf("expected missing prompter error, got %v", err)
	}
}

func TestDeleteCommandMapsNotFoundError(t *testing.T) {
	templatesDir := t.TempDir()
	cmd, _ := setupDeleteCmd(
		t,
		templatesDir,
		&fakeTemplatePrompter{confirmed: true},
		"--templates-dir",
		templatesDir,
		"--force",
		"missing-template",
	)

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected delete command to fail for missing template")
	}
	if !strings.Contains(err.Error(), "template not found") {
		t.Fatalf("expected template not found error, got %v", err)
	}
}

func setupDeleteCmd(
	t *testing.T,
	templatesDir string,
	prompter ui.Prompter,
	args ...string,
) (*cobra.Command, *bytes.Buffer) {
	t.Helper()

	cmd := newDeleteCommand(Dependencies{
		ServiceFactory: testTemplateServiceFactory(t),
		Prompter:       prompter,
	})
	output := &bytes.Buffer{}
	cmd.SetOut(output)
	cmd.SetErr(output)
	cmd.SetArgs(args)
	testutil.InitializeRuntimeConfig(t, cmd, runtime.AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: templatesDir,
		LogLevel:     runtime.LogLevelInfo,
	})
	return cmd, output
}
