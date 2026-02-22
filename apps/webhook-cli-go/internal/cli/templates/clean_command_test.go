package templates

import (
	"bytes"
	"testing"

	"github.com/spf13/cobra"
)

func TestPromptTemplateCleanConfirmHandlesEOFWithoutTrailingNewline(t *testing.T) {
	command := &cobra.Command{Use: "test"}
	command.SetIn(bytes.NewBufferString("y"))
	command.SetOut(&bytes.Buffer{})

	confirmed, err := promptTemplateCleanConfirm(command, "Delete? ")
	if err != nil {
		t.Fatalf("prompt confirm returned error: %v", err)
	}
	if !confirmed {
		t.Fatalf("expected EOF input without newline to be treated as confirmation")
	}
}

func TestPromptTemplateCleanConfirmTreatsEmptyEOFAsCancel(t *testing.T) {
	command := &cobra.Command{Use: "test"}
	command.SetIn(bytes.NewBuffer(nil))
	command.SetOut(&bytes.Buffer{})

	confirmed, err := promptTemplateCleanConfirm(command, "Delete? ")
	if err != nil {
		t.Fatalf("prompt confirm returned error: %v", err)
	}
	if confirmed {
		t.Fatalf("expected empty EOF input to be treated as cancel")
	}
}

func TestCleanCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newCleanCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected clean command to reject positional args")
	}
}
