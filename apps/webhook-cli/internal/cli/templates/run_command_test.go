package templates

import (
	"strings"
	"testing"
)

func TestRunCommandArgsRejectMissingTemplateID(t *testing.T) {
	cmd := newRunCommand(Dependencies{})
	err := cmd.Args(cmd, []string{})
	if err == nil {
		t.Fatalf("expected template id validation error")
	}
}

func TestRunCommandArgsRejectTooManyArgs(t *testing.T) {
	cmd := newRunCommand(Dependencies{})
	err := cmd.Args(cmd, []string{"github-push", "http://localhost:3000/hook", "extra"})
	if err == nil {
		t.Fatalf("expected too many args error")
	}
}

func TestRunCommandArgsRejectWhitespaceTemplateID(t *testing.T) {
	cmd := newRunCommand(Dependencies{})
	err := cmd.Args(cmd, []string{"   "})
	if err == nil {
		t.Fatalf("expected whitespace template id error")
	}
}

func TestRunCommandArgsRejectWhitespaceTargetURL(t *testing.T) {
	cmd := newRunCommand(Dependencies{})
	err := cmd.Args(cmd, []string{"github-push", "   "})
	if err == nil {
		t.Fatalf("expected whitespace target URL error")
	}
}

func TestTemplateRunLeadMessageByStatusClass(t *testing.T) {
	if got := templateRunLeadMessage(200); !strings.Contains(got, "Executed") {
		t.Fatalf("expected success lead message, got %q", got)
	}
	if got := templateRunLeadMessage(301); !strings.Contains(got, "redirect response") {
		t.Fatalf("expected redirect lead message, got %q", got)
	}
	if got := templateRunLeadMessage(400); !strings.Contains(got, "HTTP error") {
		t.Fatalf("expected error lead message, got %q", got)
	}
}
