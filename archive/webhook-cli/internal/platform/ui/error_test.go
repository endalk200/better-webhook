package ui

import (
	"errors"
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"
)

func TestFormatErrorHandlesNilError(t *testing.T) {
	t.Run("nil error", func(t *testing.T) {
		output := FormatError(nil)
		plain := ansi.Strip(output)

		if !strings.Contains(plain, "Error:") {
			t.Fatalf("expected formatted error label, got %q", plain)
		}
	})

	t.Run("non-nil error", func(t *testing.T) {
		output := FormatError(errors.New("boom"))
		plain := ansi.Strip(output)

		if !strings.Contains(plain, "Error:") || !strings.Contains(plain, "boom") {
			t.Fatalf("expected formatted non-nil error output, got %q", plain)
		}
	})
}
