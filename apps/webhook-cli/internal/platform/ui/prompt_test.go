package ui

import (
	"bytes"
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
