package templates

import "testing"

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
