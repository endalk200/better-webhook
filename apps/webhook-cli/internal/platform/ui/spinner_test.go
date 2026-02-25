package ui

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"testing"
)

func TestWithSpinnerReturnsErrorWhenActionIsNil(t *testing.T) {
	err := WithSpinner("testing spinner", &bytes.Buffer{}, nil)
	if err == nil {
		t.Fatalf("expected error when action is nil")
	}
	if !strings.Contains(err.Error(), "action is nil") {
		t.Fatalf("expected nil action error, got %v", err)
	}
}

func TestWithSpinnerRunsActionWhenTTYRenderingIsDisabled(t *testing.T) {
	called := false
	err := WithSpinner("testing spinner", &bytes.Buffer{}, func() error {
		called = true
		return nil
	})
	if err != nil {
		t.Fatalf("expected action to succeed, got %v", err)
	}
	if !called {
		t.Fatalf("expected action to run")
	}
}

func TestWithSpinnerPropagatesActionErrorWhenTTYRenderingIsDisabled(t *testing.T) {
	expected := errors.New("action failed")
	err := WithSpinner("testing spinner", &bytes.Buffer{}, func() error {
		return expected
	})
	if !errors.Is(err, expected) {
		t.Fatalf("expected action error to propagate, got %v", err)
	}
}

func TestWithSpinnerRendersCompletionWhenRenderingIsForced(t *testing.T) {
	originalRenderEnabled := spinnerRenderEnabled
	spinnerRenderEnabled = func(_ io.Writer) bool { return true }
	t.Cleanup(func() {
		spinnerRenderEnabled = originalRenderEnabled
	})

	var out bytes.Buffer
	err := WithSpinner("testing spinner", &out, func() error {
		return nil
	})
	if err != nil {
		t.Fatalf("expected spinner action to succeed, got %v", err)
	}
	rendered := out.String()
	if !strings.Contains(rendered, SuccessIcon) || !strings.Contains(rendered, "testing spinner") {
		t.Fatalf("expected completion line in rendered spinner output, got %q", rendered)
	}
}
