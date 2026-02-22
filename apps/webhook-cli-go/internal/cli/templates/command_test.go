package templates

import (
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
	for _, sub := range cmd.Commands() {
		delete(expected, sub.Name())
	}
	if len(expected) != 0 {
		t.Fatalf("missing expected subcommands: %v", expected)
	}
}
