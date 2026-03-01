package templates

import "testing"

func TestListCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newListCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected list command to reject positional args")
	}
}

func TestListCommandSupportsLocalFlag(t *testing.T) {
	cmd := newListCommand(Dependencies{})
	if err := cmd.Flags().Set("local", "true"); err != nil {
		t.Fatalf("set local flag: %v", err)
	}
	value, err := cmd.Flags().GetBool("local")
	if err != nil {
		t.Fatalf("get local flag: %v", err)
	}
	if !value {
		t.Fatalf("expected local flag to be true")
	}
}
