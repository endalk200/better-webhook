package ui

import (
	"errors"
	"net/url"
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

func TestFormatTargetConnectivityError(t *testing.T) {
	err := FormatTargetConnectivityError(&url.Error{
		Op:  "Post",
		URL: "http://127.0.0.1:1/hooks/github",
		Err: errors.New("connection refused"),
	})
	if err == nil {
		t.Fatalf("expected connectivity error")
	}
	if got, want := err.Error(), "could not reach target URL http://127.0.0.1:1/hooks/github: connection refused"; got != want {
		t.Fatalf("error mismatch: got %q want %q", got, want)
	}
}

func TestFormatTargetConnectivityErrorReturnsNilForNonURLError(t *testing.T) {
	if err := FormatTargetConnectivityError(errors.New("boom")); err != nil {
		t.Fatalf("expected nil for non-url error, got %v", err)
	}
}
