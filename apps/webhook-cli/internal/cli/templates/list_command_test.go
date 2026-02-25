package templates

import "testing"

func TestListCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newListCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected list command to reject positional args")
	}
}
