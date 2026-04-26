package cli

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func execute(args ...string) (string, error) {
	var out bytes.Buffer
	cmd := NewRootCommand(BuildInfo{
		Version: "9.8.7-test.1",
		Commit:  "abc123",
		Date:    "2026-04-25T00:00:00Z",
		BuiltBy: "test",
	})
	cmd.SetOut(&out)
	cmd.SetErr(&out)
	cmd.SetArgs(args)

	err := cmd.Execute()

	return out.String(), err
}

func TestNoArgumentsShowsHelp(t *testing.T) {
	output, err := execute()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if !strings.Contains(output, "Usage:") {
		t.Fatalf("expected help output, got %q", output)
	}
}

func TestVersionFlag(t *testing.T) {
	output, err := execute("--version")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if output != "bw version 9.8.7-test.1\n" {
		t.Fatalf("unexpected output: %q", output)
	}
}

func TestVersionCommand(t *testing.T) {
	output, err := execute("version")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if output != "bw version 9.8.7-test.1\n" {
		t.Fatalf("unexpected output: %q", output)
	}
}

func TestVerboseVersionCommand(t *testing.T) {
	output, err := execute("version", "--verbose")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []string{
		"bw version 9.8.7-test.1",
		"commit: abc123",
		"date: 2026-04-25T00:00:00Z",
		"built-by: test",
	}

	for _, line := range expected {
		if !strings.Contains(output, line) {
			t.Fatalf("expected output to contain %q, got %q", line, output)
		}
	}
}

func TestVersionCommandJSONFormat(t *testing.T) {
	output, err := execute("version", "--format", "json")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var parsed map[string]string
	if err := json.Unmarshal([]byte(output), &parsed); err != nil {
		t.Fatalf("expected JSON output, got %q: %v", output, err)
	}

	expected := map[string]string{
		"schemaVersion": "1",
		"command":       "version",
		"version":       "9.8.7-test.1",
		"commit":        "abc123",
		"date":          "2026-04-25T00:00:00Z",
		"builtBy":       "test",
	}

	for key, value := range expected {
		if parsed[key] != value {
			t.Fatalf("expected %s to be %q, got %q in %q", key, value, parsed[key], output)
		}
	}
}

func TestVersionCommandRejectsUnsupportedFormat(t *testing.T) {
	_, err := execute("version", "--format", "xml")
	if err == nil {
		t.Fatal("expected unsupported format to fail")
	}

	if !strings.Contains(err.Error(), "unsupported output format") {
		t.Fatalf("expected unsupported format error, got %v", err)
	}
}

func TestUnknownCommandFails(t *testing.T) {
	_, err := execute("missing")
	if err == nil {
		t.Fatal("expected unknown command to fail")
	}
}
