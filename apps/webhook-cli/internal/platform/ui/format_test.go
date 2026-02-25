package ui

import (
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"
)

func TestFormatBodyPreviewSanitizesANSISequences(t *testing.T) {
	output := FormatBodyPreview([]byte("ok \x1b[31mred\x1b[0m"), false)
	plain := ansi.Strip(output)

	if strings.Contains(plain, "[31m") {
		t.Fatalf("expected ANSI escape sequence to be removed, got %q", plain)
	}
	if !strings.Contains(plain, "ok red") {
		t.Fatalf("expected body text to remain readable, got %q", plain)
	}
}

func TestFormatBodyPreviewEscapesControlCharacters(t *testing.T) {
	output := FormatBodyPreview([]byte("line1\rline2\x07"), false)
	plain := ansi.Strip(output)

	if !strings.Contains(plain, `\x0d`) {
		t.Fatalf("expected carriage return to be escaped, got %q", plain)
	}
	if !strings.Contains(plain, `\x07`) {
		t.Fatalf("expected bell character to be escaped, got %q", plain)
	}
	if strings.Contains(plain, "\r") {
		t.Fatalf("expected raw carriage return to be removed, got %q", plain)
	}
}

func TestFormatBodyPreviewKeepsTruncatedHint(t *testing.T) {
	output := FormatBodyPreview([]byte(`{"ok":true}`), true)
	plain := ansi.Strip(output)
	if !strings.Contains(plain, "... (truncated)") {
		t.Fatalf("expected truncated hint in preview output, got %q", plain)
	}
}
