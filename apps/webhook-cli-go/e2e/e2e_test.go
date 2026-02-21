//go:build e2e

package e2e

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestVersionFlag(t *testing.T) {
	binaryPath := buildBinary(t)
	output, err := runCLI(t, binaryPath, nil, "--version")
	if err != nil {
		t.Fatalf("run --version: %v\noutput:\n%s", err, output)
	}
	if strings.TrimSpace(output) == "" {
		t.Fatalf("expected non-empty version output")
	}
}

func TestCaptureLifecycle(t *testing.T) {
	binaryPath := buildBinary(t)
	capturesDir := t.TempDir()
	configPath := writeConfig(t, capturesDir)

	serverCmd, address, outputLog, stopStreams := startCaptureServer(t, binaryPath, configPath)
	defer func() {
		stopCaptureServer(t, serverCmd, outputLog, stopStreams)
	}()

	requestBody := `{"event":"e2e"}`
	resp, err := http.Post("http://"+address+"/webhooks/e2e", "application/json", strings.NewReader(requestBody))
	if err != nil {
		t.Fatalf("post webhook: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200 from capture endpoint, got %d", resp.StatusCode)
	}

	stopCaptureServer(t, serverCmd, outputLog, stopStreams)

	listOutput, err := runCLI(t, binaryPath, nil, "--config", configPath, "captures", "list", "--limit", "10")
	if err != nil {
		t.Fatalf("list captures: %v\noutput:\n%s", err, listOutput)
	}
	if !strings.Contains(listOutput, "Captured webhooks:") {
		t.Fatalf("expected captures list output, got:\n%s", listOutput)
	}

	id := extractCaptureID(t, listOutput)
	deleteOutput, err := runCLI(t, binaryPath, nil, "--config", configPath, "captures", "delete", "--force", id)
	if err != nil {
		t.Fatalf("delete capture: %v\noutput:\n%s", err, deleteOutput)
	}
	if !strings.Contains(deleteOutput, "Deleted capture") {
		t.Fatalf("expected delete output, got:\n%s", deleteOutput)
	}

	emptyListOutput, err := runCLI(t, binaryPath, nil, "--config", configPath, "captures", "list", "--limit", "10")
	if err != nil {
		t.Fatalf("list captures after delete: %v\noutput:\n%s", err, emptyListOutput)
	}
	if !strings.Contains(emptyListOutput, "No captures found.") {
		t.Fatalf("expected empty list output, got:\n%s", emptyListOutput)
	}
}

func runCLI(t *testing.T, binaryPath string, stdin io.Reader, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command(binaryPath, args...)
	cmd.Dir = filepath.Join("..")
	if stdin != nil {
		cmd.Stdin = stdin
	}
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func buildBinary(t *testing.T) string {
	t.Helper()
	binaryPath := filepath.Join(t.TempDir(), "better-webhook-e2e")
	buildCmd := exec.Command("go", "build", "-o", binaryPath, "../cmd/better-webhook")
	buildCmd.Dir = filepath.Join("..", "e2e")
	output, err := buildCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("build e2e binary: %v\noutput:\n%s", err, string(output))
	}
	return binaryPath
}

func writeConfig(t *testing.T, capturesDir string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.toml")
	normalizedCapturesDir := filepath.ToSlash(capturesDir)
	content := `captures_dir = "` + normalizedCapturesDir + `"
log_level = "info"
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write e2e config: %v", err)
	}
	return path
}

func startCaptureServer(t *testing.T, binaryPath string, configPath string) (*exec.Cmd, string, *strings.Builder, func()) {
	t.Helper()
	cmd := exec.Command(binaryPath, "--config", configPath, "capture", "--port", "0")
	cmd.Dir = filepath.Join("..")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatalf("capture stdout pipe: %v", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		t.Fatalf("capture stderr pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		t.Fatalf("start capture server: %v", err)
	}

	var outputLog strings.Builder
	streamDone := make(chan struct{})
	var streamDoneOnce sync.Once
	stopStreams := func() {
		streamDoneOnce.Do(func() {
			close(streamDone)
		})
	}
	lines := make(chan string, 64)
	stream := func(reader io.Reader) {
		scanner := bufio.NewScanner(reader)
		for scanner.Scan() {
			line := scanner.Text()
			select {
			case lines <- line:
			case <-streamDone:
				return
			}
		}
	}
	go stream(stdout)
	go stream(stderr)

	deadline := time.After(20 * time.Second)
	for {
		select {
		case line := <-lines:
			outputLog.WriteString(line)
			outputLog.WriteByte('\n')
			const prefix = "Webhook capture server listening on http://"
			if strings.Contains(line, prefix) {
				address := strings.TrimPrefix(strings.TrimSpace(strings.SplitN(line, prefix, 2)[1]), "http://")
				return cmd, address, &outputLog, stopStreams
			}
		case <-deadline:
			stopCaptureServer(t, cmd, &outputLog, stopStreams)
			t.Fatalf("timed out waiting for capture server to start\noutput:\n%s", outputLog.String())
		}
	}
}

func stopCaptureServer(t *testing.T, cmd *exec.Cmd, outputLog *strings.Builder, stopStreams func()) {
	t.Helper()
	if stopStreams != nil {
		stopStreams()
	}
	if cmd == nil || cmd.Process == nil || cmd.ProcessState != nil {
		return
	}
	_ = cmd.Process.Signal(os.Interrupt)

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			if isInterruptExit(err) {
				return
			}
			output := ""
			if outputLog != nil {
				output = outputLog.String()
			}
			t.Fatalf("capture server exited with error: %v\noutput:\n%s", err, output)
		}
	case <-time.After(10 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("timed out waiting for capture server shutdown")
	}
}

func isInterruptExit(err error) bool {
	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		return false
	}
	return strings.Contains(strings.ToLower(exitErr.Error()), strings.ToLower(os.Interrupt.String()))
}

func extractCaptureID(t *testing.T, listOutput string) string {
	t.Helper()
	re := regexp.MustCompile(`(?m)^- ([0-9a-f]{8}) \[`)
	matches := re.FindStringSubmatch(listOutput)
	if len(matches) < 2 {
		t.Fatalf("failed to extract capture ID from output:\n%s", listOutput)
	}
	return fmt.Sprintf("%s", matches[1])
}
