package templates

import (
	"testing"
)

func TestDownloadCommandArgsRejectTooManyArgs(t *testing.T) {
	cmd := newDownloadCommand(Dependencies{})
	err := cmd.Args(cmd, []string{"a", "b"})
	if err == nil {
		t.Fatalf("expected too many args error")
	}
}

func TestDownloadCommandArgsRequireAllOrTemplateID(t *testing.T) {
	cmd := newDownloadCommand(Dependencies{})
	err := cmd.Args(cmd, []string{})
	if err == nil {
		t.Fatalf("expected required args validation error")
	}
}

func TestDownloadCommandArgsRejectTemplateIDWithAll(t *testing.T) {
	cmd := newDownloadCommand(Dependencies{})
	if err := cmd.Flags().Set("all", "true"); err != nil {
		t.Fatalf("set all flag: %v", err)
	}
	err := cmd.Args(cmd, []string{"github-push"})
	if err == nil {
		t.Fatalf("expected mutual exclusivity validation error")
	}
}
