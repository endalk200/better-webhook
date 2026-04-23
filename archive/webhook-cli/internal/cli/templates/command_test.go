package templates

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
	platformplaceholders "github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/placeholders"
)

func TestMapTemplateCommandErrorForNotFound(t *testing.T) {
	err := mapTemplateCommandError(domain.ErrTemplateNotFound, "github-push")
	if err == nil {
		t.Fatalf("expected mapped error")
	}
	if got, want := err.Error(), "template not found: github-push"; got != want {
		t.Fatalf("error mismatch: got %q want %q", got, want)
	}
	if !errors.Is(err, domain.ErrTemplateNotFound) {
		t.Fatalf("expected wrapped error to preserve domain.ErrTemplateNotFound")
	}
}

func TestMapTemplateCommandErrorPassThrough(t *testing.T) {
	rootErr := errors.New("raw failure")
	err := mapTemplateCommandError(rootErr, "")
	if err == nil || err.Error() != "raw failure" {
		t.Fatalf("expected pass-through error")
	}
}

func TestNewCommandRegistersTemplateSubcommands(t *testing.T) {
	cmd := NewCommand(Dependencies{})
	expected := map[string]bool{
		"list": true, "download": true, "delete": true, "search": true, "cache": true, "clean": true, "run": true,
	}
	actual := make(map[string]bool, len(cmd.Commands()))
	for _, sub := range cmd.Commands() {
		actual[sub.Name()] = true
	}
	if len(actual) != len(expected) {
		t.Fatalf("subcommand count mismatch: got %d want %d", len(actual), len(expected))
	}
	for name := range expected {
		if !actual[name] {
			t.Fatalf("missing expected subcommand: %s", name)
		}
	}
	for name := range actual {
		if !expected[name] {
			t.Fatalf("unexpected subcommand: %s", name)
		}
	}
}

func TestMapTemplateCommandErrorPreservesCancellation(t *testing.T) {
	err := mapTemplateCommandError(context.Canceled, "")
	if err == nil {
		t.Fatalf("expected mapped cancellation error")
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected wrapped error to preserve context.Canceled")
	}
}

func TestMapTemplateCommandErrorIncludesBodyPlaceholderCause(t *testing.T) {
	root := errors.Join(
		apptemplates.ErrRunInvalidBody,
		fmt.Errorf("%w: PAYLOAD_SOURCE", platformplaceholders.ErrMissingEnvironmentVariable),
	)

	err := mapTemplateCommandError(root, "")
	if err == nil {
		t.Fatalf("expected mapped body error")
	}
	if !strings.Contains(err.Error(), "template body is invalid:") {
		t.Fatalf("expected template body prefix, got %q", err.Error())
	}
	if !strings.Contains(err.Error(), "PAYLOAD_SOURCE") {
		t.Fatalf("expected missing variable name in message, got %q", err.Error())
	}
}

func TestMapTemplateCommandErrorGuidesEnvPlaceholderOptIn(t *testing.T) {
	root := errors.Join(
		apptemplates.ErrRunInvalidBody,
		fmt.Errorf("%w: SECRET_TOKEN", platformplaceholders.ErrEnvironmentPlaceholdersDisabled),
	)

	err := mapTemplateCommandError(root, "")
	if err == nil {
		t.Fatalf("expected mapped body error")
	}
	if !strings.Contains(err.Error(), "--allow-env-placeholders") {
		t.Fatalf("expected opt-in guidance, got %q", err.Error())
	}
}

func TestMapTemplateCommandErrorPreservesRunInvalidTargetURL(t *testing.T) {
	root := fmt.Errorf("%w: %w", apptemplates.ErrRunInvalidTargetURL, errors.New("bad target"))
	err := mapTemplateCommandError(root, "")
	if err == nil {
		t.Fatalf("expected mapped error")
	}
	if !errors.Is(err, apptemplates.ErrRunInvalidTargetURL) {
		t.Fatalf("expected mapped error to preserve ErrRunInvalidTargetURL")
	}
}

func TestMapTemplateCommandErrorPreservesRunInvalidBodySentinel(t *testing.T) {
	root := errors.Join(
		apptemplates.ErrRunInvalidBody,
		fmt.Errorf("%w: HEADER_VALUE", platformplaceholders.ErrMissingEnvironmentVariable),
	)
	err := mapTemplateCommandError(root, "")
	if err == nil {
		t.Fatalf("expected mapped body error")
	}
	if !errors.Is(err, apptemplates.ErrRunInvalidBody) {
		t.Fatalf("expected mapped error to preserve ErrRunInvalidBody")
	}
}
