package cmd

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/endalk200/better-webhook/apps/cli/internal/version"
)

func TestRootCommandShowsHelpByDefault(t *testing.T) {
	rootCmd := newRootCommand()
	var output bytes.Buffer

	rootCmd.SetOut(&output)
	rootCmd.SetErr(&output)
	rootCmd.SetArgs([]string{})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("expected help to succeed, got error: %v", err)
	}

	if !strings.Contains(output.String(), "version") {
		t.Fatalf("expected help output to mention version command, got %q", output.String())
	}
}

func TestRootCommandVersionFlag(t *testing.T) {
	setTestVersion(t)

	rootCmd := newRootCommand()
	var output bytes.Buffer

	rootCmd.SetOut(&output)
	rootCmd.SetErr(&output)
	rootCmd.SetArgs([]string{"--version"})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("expected --version to succeed, got error: %v", err)
	}

	if got, want := output.String(), "2.0.0-alpha.1\n"; got != want {
		t.Fatalf("expected version output %q, got %q", want, got)
	}
}

func TestVersionCommandHumanOutput(t *testing.T) {
	setTestVersion(t)

	rootCmd := newRootCommand()
	var output bytes.Buffer

	rootCmd.SetOut(&output)
	rootCmd.SetErr(&output)
	rootCmd.SetArgs([]string{"version"})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("expected version command to succeed, got error: %v", err)
	}

	if got, want := output.String(), "2.0.0-alpha.1\n"; got != want {
		t.Fatalf("expected version output %q, got %q", want, got)
	}
}

func TestVersionCommandJSONOutput(t *testing.T) {
	setTestVersion(t)

	rootCmd := newRootCommand()
	var output bytes.Buffer

	rootCmd.SetOut(&output)
	rootCmd.SetErr(&output)
	rootCmd.SetArgs([]string{"version", "--json"})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("expected version --json to succeed, got error: %v", err)
	}

	var payload version.Info
	if err := json.Unmarshal(output.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal version json: %v", err)
	}

	if payload.SchemaVersion != 1 {
		t.Fatalf("expected schemaVersion 1, got %d", payload.SchemaVersion)
	}
	if payload.Version != "2.0.0-alpha.1" {
		t.Fatalf("expected version %q, got %q", "2.0.0-alpha.1", payload.Version)
	}
	if payload.Commit != "abc1234" {
		t.Fatalf("expected commit %q, got %q", "abc1234", payload.Commit)
	}
	if payload.Date != "2026-04-23T18:00:00Z" {
		t.Fatalf("expected date %q, got %q", "2026-04-23T18:00:00Z", payload.Date)
	}
	if payload.Platform == "" {
		t.Fatalf("expected platform to be populated")
	}
}

func setTestVersion(t *testing.T) {
	t.Helper()

	previousVersion := version.Version
	previousCommit := version.Commit
	previousDate := version.Date

	version.Version = "2.0.0-alpha.1"
	version.Commit = "abc1234"
	version.Date = "2026-04-23T18:00:00Z"

	t.Cleanup(func() {
		version.Version = previousVersion
		version.Commit = previousCommit
		version.Date = previousDate
	})
}
