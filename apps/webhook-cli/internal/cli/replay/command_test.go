package replay

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/replay"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

func TestReplayLeadMessageByStatusClass(t *testing.T) {
	if got := replayLeadMessage(200); !strings.Contains(got, "Replayed") {
		t.Fatalf("expected success lead message, got %q", got)
	}
	if got := replayLeadMessage(302); !strings.Contains(got, "redirect response") {
		t.Fatalf("expected redirect lead message, got %q", got)
	}
	if got := replayLeadMessage(500); !strings.Contains(got, "HTTP error") {
		t.Fatalf("expected error lead message, got %q", got)
	}
}

func TestMapReplayCommandErrorForCaptureNotFound(t *testing.T) {
	err := mapReplayCommandError(domain.ErrCaptureNotFound, "deadbeef")
	if err == nil {
		t.Fatalf("expected mapped error")
	}
	if got := err.Error(); got != "capture not found: deadbeef" {
		t.Fatalf("unexpected error message: %q", got)
	}
}

func TestMapReplayCommandErrorForInvalidBaseURL(t *testing.T) {
	err := mapReplayCommandError(appreplay.ErrInvalidBaseURL, "deadbeef")
	if err == nil {
		t.Fatalf("expected mapped error")
	}
	if got := err.Error(); got != "base URL is invalid" {
		t.Fatalf("unexpected error message: %q", got)
	}
}

func TestMapReplayCommandErrorForCancellation(t *testing.T) {
	err := mapReplayCommandError(context.Canceled, "deadbeef")
	if err == nil {
		t.Fatalf("expected mapped error")
	}
	if got := err.Error(); got != "operation cancelled" {
		t.Fatalf("unexpected error message: %q", got)
	}
}

func TestMapReplayCommandErrorForDeadlineExceeded(t *testing.T) {
	err := mapReplayCommandError(context.DeadlineExceeded, "deadbeef")
	if err == nil {
		t.Fatalf("expected mapped error")
	}
	if got := err.Error(); got != "operation timed out" {
		t.Fatalf("unexpected error message: %q", got)
	}
}

func TestMapReplayCommandErrorPassThrough(t *testing.T) {
	rootErr := errors.New("raw transport failure")
	err := mapReplayCommandError(rootErr, "deadbeef")
	if err == nil {
		t.Fatalf("expected error")
	}
	if !strings.Contains(err.Error(), "raw transport failure") {
		t.Fatalf("expected original error, got %v", err)
	}
}

func TestValidateReplayCommandArgsRequiresSelector(t *testing.T) {
	err := validateReplayCommandArgs(nil, []string{})
	if err == nil {
		t.Fatalf("expected missing selector error")
	}
	if got := err.Error(); got != "capture selector is required. List captures with `better-webhook captures list` and pass a capture ID" {
		t.Fatalf("unexpected error message: %q", got)
	}
}

func TestReplayCommandNoArgsShowsHelpfulError(t *testing.T) {
	cmd := NewCommand(Dependencies{})
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err == nil {
		t.Fatalf("expected command error for missing args")
	}
	if !strings.Contains(err.Error(), "capture selector is required") {
		t.Fatalf("expected helpful error, got %v", err)
	}
}
