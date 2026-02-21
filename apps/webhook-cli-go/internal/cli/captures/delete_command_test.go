package captures

import (
	"bytes"
	"testing"

	"github.com/spf13/cobra"
)

func TestPromptConfirmHandlesEOFWithoutTrailingNewline(t *testing.T) {
	command := &cobra.Command{Use: "test"}
	command.SetIn(bytes.NewBufferString("y"))
	command.SetOut(&bytes.Buffer{})

	confirmed, err := promptConfirm(command, "Delete? ")
	if err != nil {
		t.Fatalf("prompt confirm returned error: %v", err)
	}
	if !confirmed {
		t.Fatalf("expected EOF input without newline to be treated as confirmation")
	}
}

func TestPromptConfirmTreatsEmptyEOFAsCancel(t *testing.T) {
	command := &cobra.Command{Use: "test"}
	command.SetIn(bytes.NewBuffer(nil))
	command.SetOut(&bytes.Buffer{})

	confirmed, err := promptConfirm(command, "Delete? ")
	if err != nil {
		t.Fatalf("prompt confirm returned error: %v", err)
	}
	if confirmed {
		t.Fatalf("expected empty EOF input to be treated as cancel")
	}
}
