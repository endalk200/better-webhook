package ui

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestHuhPrompterConfirmSupportsCommandIO(t *testing.T) {
	prompter := HuhPrompter{}
	var out bytes.Buffer

	confirmed, err := prompter.Confirm("Delete capture?", strings.NewReader("y\n"), &out)
	if err != nil {
		t.Fatalf("confirm returned error: %v", err)
	}
	if !confirmed {
		t.Fatalf("expected confirmation to return true")
	}
	if !strings.Contains(out.String(), "Delete capture? [y/N]:") {
		t.Fatalf("expected prompt to be written to command output, got %q", out.String())
	}
}

func TestHuhPrompterConfirmEOFDefaultsToCancel(t *testing.T) {
	prompter := HuhPrompter{}
	var out bytes.Buffer

	confirmed, err := prompter.Confirm("Delete capture?", strings.NewReader(""), &out)
	if err != nil {
		t.Fatalf("confirm returned error: %v", err)
	}
	if confirmed {
		t.Fatalf("expected empty EOF input to default to cancel")
	}
}

func TestHuhPrompterConfirmEOFWithoutTrailingNewline(t *testing.T) {
	prompter := HuhPrompter{}
	var out bytes.Buffer

	confirmed, err := prompter.Confirm("Delete capture?", strings.NewReader("yes"), &out)
	if err != nil {
		t.Fatalf("confirm returned error: %v", err)
	}
	if !confirmed {
		t.Fatalf("expected EOF without newline to be parsed as confirmation")
	}
}

func TestHuhPrompterConfirmRepromptsOnInvalidInput(t *testing.T) {
	prompter := HuhPrompter{}
	var out bytes.Buffer

	confirmed, err := prompter.Confirm("Delete capture?", strings.NewReader("maybe\nn\n"), &out)
	if err != nil {
		t.Fatalf("confirm returned error: %v", err)
	}
	if confirmed {
		t.Fatalf("expected final answer to be cancellation")
	}
	output := out.String()
	if !strings.Contains(output, "Please answer yes or no.") {
		t.Fatalf("expected invalid-answer warning, got %q", output)
	}
	if strings.Count(output, "Delete capture? [y/N]:") < 2 {
		t.Fatalf("expected prompt to be shown again after invalid answer, got %q", output)
	}
}

func TestIsSupportedPromptOutputAcceptsStdoutAndStderr(t *testing.T) {
	if !isSupportedPromptOutput(os.Stdout) {
		t.Fatalf("expected stdout to be accepted for interactive prompt output")
	}
	if !isSupportedPromptOutput(os.Stderr) {
		t.Fatalf("expected stderr to be accepted for interactive prompt output")
	}
}

func TestIsSupportedPromptOutputRejectsOtherFiles(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "prompt-output-*")
	if err != nil {
		t.Fatalf("create temp file: %v", err)
	}
	t.Cleanup(func() {
		_ = file.Close()
	})

	if isSupportedPromptOutput(file) {
		t.Fatalf("expected non-stdio file to be rejected for interactive prompt output")
	}
}
