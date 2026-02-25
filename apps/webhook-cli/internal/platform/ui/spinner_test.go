package ui

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"
)

func TestWithSpinnerReturnsErrorWhenActionIsNil(t *testing.T) {
	err := WithSpinner(context.Background(), "testing spinner", &bytes.Buffer{}, nil)
	if err == nil {
		t.Fatalf("expected error when action is nil")
	}
	if !strings.Contains(err.Error(), "action is nil") {
		t.Fatalf("expected nil action error, got %v", err)
	}
}

func TestWithSpinnerRunsActionWhenTTYRenderingIsDisabled(t *testing.T) {
	called := false
	err := WithSpinner(context.Background(), "testing spinner", &bytes.Buffer{}, func(_ context.Context) error {
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
	err := WithSpinner(context.Background(), "testing spinner", &bytes.Buffer{}, func(_ context.Context) error {
		return expected
	})
	if !errors.Is(err, expected) {
		t.Fatalf("expected action error to propagate, got %v", err)
	}
}

func TestWithSpinnerRendersCompletionWhenRenderingIsForced(t *testing.T) {
	var out bytes.Buffer
	err := WithSpinner(context.Background(), "testing spinner", &out, func(_ context.Context) error {
		return nil
	}, withSpinnerRenderPredicate(func(_ io.Writer) bool { return true }))
	if err != nil {
		t.Fatalf("expected spinner action to succeed, got %v", err)
	}
	rendered := out.String()
	if !strings.Contains(rendered, SuccessIcon) || !strings.Contains(rendered, "testing spinner") {
		t.Fatalf("expected completion line in rendered spinner output, got %q", rendered)
	}
	if !strings.Contains(rendered, "\r\033[2K") {
		t.Fatalf("expected completion render to clear line first, got %q", rendered)
	}
}
