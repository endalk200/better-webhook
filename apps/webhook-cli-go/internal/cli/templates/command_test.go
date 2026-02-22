package templates

import (
	"context"
	"errors"
	"testing"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
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
		"list": true, "download": true, "local": true, "search": true, "cache": true, "clean": true,
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
