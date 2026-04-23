package templates

import (
	"strings"
	"testing"
)

func TestSearchCommandArgsRequiresQuery(t *testing.T) {
	cmd := newSearchCommand(Dependencies{})
	err := cmd.Args(cmd, []string{})
	if err == nil {
		t.Fatalf("expected missing query error")
	}
	if !strings.Contains(err.Error(), "search query is required") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestSearchCommandArgsRejectsExtraArgs(t *testing.T) {
	cmd := newSearchCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"github", "extra"}); err == nil {
		t.Fatalf("expected extra args validation error")
	}
}

func TestSearchCommandArgsRejectsWhitespaceQuery(t *testing.T) {
	cmd := newSearchCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"   "}); err == nil {
		t.Fatalf("expected whitespace query validation error")
	}
}
