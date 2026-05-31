package cli

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

	if len(parsed) != len(expected) {
		t.Fatalf("expected %d JSON fields, got %d in %q", len(expected), len(parsed), output)
	}

	for key, value := range expected {
		if parsed[key] != value {
			t.Fatalf("expected %s to be %q, got %q in %q", key, value, parsed[key], output)
		}
	}
}

func TestVersionCommandRejectsVerboseJSONFormat(t *testing.T) {
	_, err := execute("version", "--verbose", "--format", "json")
	if err == nil {
		t.Fatal("expected verbose JSON format to fail")
	}

	if !strings.Contains(err.Error(), "--verbose only applies to human format") {
		t.Fatalf("expected verbose JSON format error, got %v", err)
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

func TestMachineErrorEnvelopeIncludesSchemaVersion(t *testing.T) {
	var output bytes.Buffer
	if err := PrintMachineError(&output, errors.New("project not found")); err != nil {
		t.Fatalf("expected machine error render to succeed: %v", err)
	}

	var envelope struct {
		SchemaVersion string `json:"schemaVersion"`
		OK            bool   `json:"ok"`
		Error         struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(output.Bytes(), &envelope); err != nil {
		t.Fatalf("expected machine error JSON, got %q: %v", output.String(), err)
	}
	if envelope.SchemaVersion != "1" || envelope.OK || envelope.Error.Message != "project not found" {
		t.Fatalf("unexpected machine error envelope: %#v", envelope)
	}
}

func TestArgsRequestJSONUsesLastFormatFlagBeforeSeparator(t *testing.T) {
	if !ArgsRequestJSON([]string{"endpoint", "list", "--format", "json"}) {
		t.Fatal("expected separated --format json to request machine output")
	}
	if !ArgsRequestJSON([]string{"--format=human", "--format=json", "endpoint", "list"}) {
		t.Fatal("expected last format flag to win")
	}
	if ArgsRequestJSON([]string{"--format", "json", "--", "--format", "human"}) != true {
		t.Fatal("expected arguments after -- to be ignored")
	}
	if ArgsRequestJSON([]string{"--format", "human", "endpoint", "list"}) {
		t.Fatal("expected human format to skip machine output")
	}
}

func TestUnknownCommandFails(t *testing.T) {
	_, err := execute("missing")
	if err == nil {
		t.Fatal("expected unknown command to fail")
	}
}

func TestProjectEndpointTemplateRunMachineFlow(t *testing.T) {
	projectDir := t.TempDir()
	templateHome := t.TempDir()
	var receivedBody string
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body := new(bytes.Buffer)
		_, _ = body.ReadFrom(request.Body)
		receivedBody = body.String()
		writer.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(upstream.Close)

	output, err := execute("--format", "json", "init", "--dir", projectDir, "--name", "demo")
	if err != nil {
		t.Fatalf("expected init to succeed: %v", err)
	}
	assertMachineOK(t, output, "init")

	output, err = execute(
		"--format", "json",
		"--project", projectDir,
		"endpoint", "create",
		"--id", "generic-main",
		"--mode", "generic",
		"--target", upstream.URL,
		"--route", "/webhooks/generic",
	)
	if err != nil {
		t.Fatalf("expected endpoint create to succeed: %v", err)
	}
	assertMachineOK(t, output, "endpoint.create")

	output, err = execute(
		"--format", "json",
		"--project", projectDir,
		"--template-home", templateHome,
		"templates", "run", "generic/json",
		"--endpoint", "generic-main",
	)
	if err != nil {
		t.Fatalf("expected template run to succeed: %v", err)
	}
	assertMachineOK(t, output, "templates.run")
	if !strings.Contains(receivedBody, "better-webhook local template") {
		t.Fatalf("expected rendered template body, got %q", receivedBody)
	}

	configData, err := os.ReadFile(filepath.Join(projectDir, ".better-webhook", "project.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(configData), `"templateId": "generic/json"`) {
		t.Fatalf("expected template run history to be recorded, got %s", configData)
	}
}

func TestProviderEndpointRejectsIncompatibleTemplate(t *testing.T) {
	projectDir := t.TempDir()
	templateHome := t.TempDir()
	if _, err := execute("init", "--dir", projectDir, "--name", "demo"); err != nil {
		t.Fatalf("expected init to succeed: %v", err)
	}
	if _, err := execute(
		"--project", projectDir,
		"endpoint", "create",
		"--id", "stripe-main",
		"--mode", "provider",
		"--provider", "stripe",
		"--secret-env", "STRIPE_WEBHOOK_SECRET",
		"--target", "http://127.0.0.1:3000/webhook",
		"--route", "/webhooks/stripe",
	); err != nil {
		t.Fatalf("expected endpoint create to succeed: %v", err)
	}

	_, err := execute(
		"--project", projectDir,
		"--template-home", templateHome,
		"templates", "run", "github/ping",
		"--endpoint", "stripe-main",
	)
	if err == nil {
		t.Fatal("expected provider/template mismatch to fail")
	}
	if !strings.Contains(err.Error(), "cannot target endpoint") {
		t.Fatalf("expected compatibility error, got %v", err)
	}
}

func TestEndpointCreateAndUpdateHaveDistinctSemantics(t *testing.T) {
	projectDir := t.TempDir()
	if _, err := execute("init", "--dir", projectDir, "--name", "demo"); err != nil {
		t.Fatalf("expected init to succeed: %v", err)
	}

	createArgs := []string{
		"--project", projectDir,
		"endpoint", "create",
		"--id", "generic-main",
		"--target", "http://127.0.0.1:3000/webhook",
		"--route", "/webhooks/generic",
	}
	if _, err := execute(createArgs...); err != nil {
		t.Fatalf("expected endpoint create to succeed: %v", err)
	}
	if _, err := execute(createArgs...); err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("expected duplicate create to fail, got %v", err)
	}
	if _, err := execute(
		"--project", projectDir,
		"endpoint", "update",
		"--id", "missing",
		"--target", "http://127.0.0.1:3000/webhook",
		"--route", "/webhooks/missing",
	); err == nil || !strings.Contains(err.Error(), "did not exist") {
		t.Fatalf("expected missing update to fail, got %v", err)
	}
}

func assertMachineOK(t *testing.T, output, command string) {
	t.Helper()
	var envelope struct {
		SchemaVersion string `json:"schemaVersion"`
		Command       string `json:"command"`
		OK            bool   `json:"ok"`
	}
	if err := json.Unmarshal([]byte(output), &envelope); err != nil {
		t.Fatalf("expected machine JSON, got %q: %v", output, err)
	}
	if envelope.SchemaVersion != "1" || envelope.Command != command || !envelope.OK {
		t.Fatalf("unexpected machine envelope: %#v from %q", envelope, output)
	}
}
