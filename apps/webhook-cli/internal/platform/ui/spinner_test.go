package ui

import (
	"bytes"
	"errors"
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
