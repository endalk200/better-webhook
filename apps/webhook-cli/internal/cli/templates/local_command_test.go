package templates

import "testing"

func TestLocalCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newLocalCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected local command to reject positional args")
	}
}
