package ui

import (
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"
)

func TestFormatErrorHandlesNilError(t *testing.T) {
	output := FormatError(nil)
	plain := ansi.Strip(output)

	if !strings.Contains(plain, "Error:") {
		t.Fatalf("expected formatted error label, got %q", plain)
	}
}
