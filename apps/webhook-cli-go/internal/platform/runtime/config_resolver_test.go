package runtime

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"
)

func TestResolveCaptureArgsEnablesVerboseForDebugLogLevel(t *testing.T) {
	command := &cobra.Command{Use: "capture"}
	command.Flags().String("captures-dir", "", "")
	command.Flags().String("host", DefaultCaptureHost, "")
	command.Flags().Int("port", DefaultCapturePort, "")
	command.Flags().Bool("verbose", DefaultCaptureVerbose, "")
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir: t.TempDir(),
		LogLevel:    LogLevelDebug,
	}))

	args, err := ResolveCaptureArgs(command)
	if err != nil {
		t.Fatalf("resolve capture args: %v", err)
	}

	if !args.Verbose {
		t.Fatalf("expected verbose mode to be enabled for debug log level")
	}
}

func TestResolveCaptureArgsUsesVerboseFlagPrecedence(t *testing.T) {
	command := &cobra.Command{Use: "capture"}
	command.Flags().String("captures-dir", "", "")
	command.Flags().String("host", DefaultCaptureHost, "")
	command.Flags().Int("port", DefaultCapturePort, "")
	command.Flags().Bool("verbose", DefaultCaptureVerbose, "")
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir: t.TempDir(),
		LogLevel:    LogLevelDebug,
	}))
	if err := command.Flags().Set("verbose", "false"); err != nil {
		t.Fatalf("set verbose flag: %v", err)
	}

	args, err := ResolveCaptureArgs(command)
	if err != nil {
		t.Fatalf("resolve capture args: %v", err)
	}
	if args.Verbose {
		t.Fatalf("expected explicit --verbose flag to take precedence over log level")
	}
}

func TestResolveReplayArgsParsesFlagsAndArguments(t *testing.T) {
	command := newReplayTestCommand(t)
	if err := command.Flags().Set("captures-dir", t.TempDir()); err != nil {
		t.Fatalf("set captures-dir: %v", err)
	}
	if err := command.Flags().Set("base-url", "http://localhost:4000"); err != nil {
		t.Fatalf("set base-url: %v", err)
	}
	if err := command.Flags().Set("method", "patch"); err != nil {
		t.Fatalf("set method: %v", err)
	}
	if err := command.Flags().Set("header", "X-Test: one"); err != nil {
		t.Fatalf("set header: %v", err)
	}
	if err := command.Flags().Set("header", "X-Other: two"); err != nil {
		t.Fatalf("set header: %v", err)
	}
	if err := command.Flags().Set("timeout", "45s"); err != nil {
		t.Fatalf("set timeout: %v", err)
	}
	if err := command.Flags().Set("verbose", "true"); err != nil {
		t.Fatalf("set verbose: %v", err)
	}

	args, err := ResolveReplayArgs(command, []string{"deadbeef", "http://localhost:5000/hook"})
	if err != nil {
		t.Fatalf("resolve replay args: %v", err)
	}
	if args.Selector != "deadbeef" {
		t.Fatalf("selector mismatch: got %q", args.Selector)
	}
	if args.Method != "PATCH" {
		t.Fatalf("method mismatch: got %q", args.Method)
	}
	if args.TargetURL != "http://localhost:5000/hook" {
		t.Fatalf("target URL mismatch: got %q", args.TargetURL)
	}
	if args.BaseURL != "http://localhost:4000" {
		t.Fatalf("base URL mismatch: got %q", args.BaseURL)
	}
	if args.Timeout != 45*time.Second {
		t.Fatalf("timeout mismatch: got %s", args.Timeout)
	}
	if !args.Verbose {
		t.Fatalf("expected verbose true")
	}
	if len(args.HeaderOverrides) != 2 {
		t.Fatalf("expected two header overrides, got %d", len(args.HeaderOverrides))
	}
}

func TestResolveReplayArgsUsesBaseURLWhenTargetMissing(t *testing.T) {
	command := newReplayTestCommand(t)
	args, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err != nil {
		t.Fatalf("resolve replay args: %v", err)
	}
	if args.TargetURL != "" {
		t.Fatalf("expected empty target URL when omitted, got %q", args.TargetURL)
	}
	if args.BaseURL != DefaultReplayBaseURL {
		t.Fatalf("base URL mismatch: got %q want %q", args.BaseURL, DefaultReplayBaseURL)
	}
}

func TestResolveReplayArgsEnablesVerboseForDebugLogLevel(t *testing.T) {
	command := newReplayTestCommand(t)
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir: t.TempDir(),
		LogLevel:    LogLevelDebug,
	}))

	args, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err != nil {
		t.Fatalf("resolve replay args: %v", err)
	}
	if !args.Verbose {
		t.Fatalf("expected verbose mode to be enabled for debug log level")
	}
}

func TestResolveReplayArgsUsesVerboseFlagPrecedence(t *testing.T) {
	command := newReplayTestCommand(t)
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir: t.TempDir(),
		LogLevel:    LogLevelDebug,
	}))
	if err := command.Flags().Set("verbose", "false"); err != nil {
		t.Fatalf("set verbose flag: %v", err)
	}

	args, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err != nil {
		t.Fatalf("resolve replay args: %v", err)
	}
	if args.Verbose {
		t.Fatalf("expected explicit --verbose flag to take precedence over log level")
	}
}

func TestResolveReplayArgsRejectsInvalidTargetURL(t *testing.T) {
	command := newReplayTestCommand(t)
	_, err := ResolveReplayArgs(command, []string{"deadbeef", "not-a-url"})
	if err == nil {
		t.Fatalf("expected invalid target URL error")
	}
	if !strings.Contains(err.Error(), "target URL is invalid") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveReplayArgsRejectsInvalidBaseURL(t *testing.T) {
	command := newReplayTestCommand(t)
	if err := command.Flags().Set("base-url", "localhost:3000"); err != nil {
		t.Fatalf("set base-url: %v", err)
	}
	_, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err == nil {
		t.Fatalf("expected invalid base URL error")
	}
	if !strings.Contains(err.Error(), "base URL is invalid") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveReplayArgsAllowsInvalidBaseURLWhenTargetProvided(t *testing.T) {
	command := newReplayTestCommand(t)
	if err := command.Flags().Set("base-url", "localhost:3000"); err != nil {
		t.Fatalf("set base-url: %v", err)
	}
	args, err := ResolveReplayArgs(command, []string{"deadbeef", "http://localhost:5000/hook"})
	if err != nil {
		t.Fatalf("resolve replay args: %v", err)
	}
	if args.TargetURL != "http://localhost:5000/hook" {
		t.Fatalf("target URL mismatch: got %q", args.TargetURL)
	}
}

func TestResolveReplayArgsRejectsInvalidHeaderOverride(t *testing.T) {
	command := newReplayTestCommand(t)
	if err := command.Flags().Set("header", "invalid-header"); err != nil {
		t.Fatalf("set header: %v", err)
	}
	_, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err == nil {
		t.Fatalf("expected invalid header override error")
	}
	if !strings.Contains(err.Error(), "key:value") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveReplayArgsRejectsNonPositiveTimeout(t *testing.T) {
	command := newReplayTestCommand(t)
	if err := command.Flags().Set("timeout", "0s"); err != nil {
		t.Fatalf("set timeout: %v", err)
	}
	_, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err == nil {
		t.Fatalf("expected timeout validation error")
	}
	if !strings.Contains(err.Error(), "timeout must be greater than 0") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveReplayArgsRejectsInvalidMethodCharacters(t *testing.T) {
	command := newReplayTestCommand(t)
	if err := command.Flags().Set("method", "PO ST"); err != nil {
		t.Fatalf("set method: %v", err)
	}
	_, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err == nil {
		t.Fatalf("expected method validation error")
	}
	if !strings.Contains(err.Error(), "method contains invalid characters") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestIsValidHTTPMethodRejectsEmpty(t *testing.T) {
	if isValidHTTPMethod("") {
		t.Fatalf("expected empty method to be invalid")
	}
}

func TestResolveReplayArgsRejectsWhitespaceSelector(t *testing.T) {
	command := newReplayTestCommand(t)
	_, err := ResolveReplayArgs(command, []string{"   "})
	if err == nil {
		t.Fatalf("expected selector validation error")
	}
	if !strings.Contains(err.Error(), "capture selector cannot be empty") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesListArgsParsesFlags(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("provider", "github"); err != nil {
		t.Fatalf("set provider: %v", err)
	}
	if err := command.Flags().Set("refresh", "true"); err != nil {
		t.Fatalf("set refresh: %v", err)
	}

	args, err := ResolveTemplatesListArgs(command)
	if err != nil {
		t.Fatalf("resolve templates list args: %v", err)
	}
	if args.Provider != "github" {
		t.Fatalf("provider mismatch: got %q", args.Provider)
	}
	if !args.Refresh {
		t.Fatalf("expected refresh true")
	}
	if args.TemplatesDir == "" {
		t.Fatalf("expected templates dir")
	}
}

func TestResolveTemplatesDownloadArgsRequiresTemplateIDWithoutAll(t *testing.T) {
	command := newTemplatesTestCommand(t)
	_, err := ResolveTemplatesDownloadArgs(command, nil)
	if err == nil {
		t.Fatalf("expected template id validation error")
	}
	if !strings.Contains(err.Error(), "template id is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesDownloadArgsAllowsAllWithoutID(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("all", "true"); err != nil {
		t.Fatalf("set all: %v", err)
	}
	args, err := ResolveTemplatesDownloadArgs(command, nil)
	if err != nil {
		t.Fatalf("resolve templates download args: %v", err)
	}
	if !args.All {
		t.Fatalf("expected all true")
	}
	if args.TemplateID != "" {
		t.Fatalf("expected empty template id")
	}
}

func TestResolveTemplatesSearchArgsRequiresQuery(t *testing.T) {
	command := newTemplatesTestCommand(t)
	_, err := ResolveTemplatesSearchArgs(command, nil)
	if err == nil {
		t.Fatalf("expected search query validation error")
	}
	if !strings.Contains(err.Error(), "search query is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func newReplayTestCommand(t *testing.T) *cobra.Command {
	t.Helper()
	command := &cobra.Command{Use: "replay"}
	command.Flags().String("captures-dir", "", "")
	command.Flags().String("base-url", DefaultReplayBaseURL, "")
	command.Flags().String("method", "", "")
	command.Flags().StringArrayP("header", "H", nil, "")
	command.Flags().Duration("timeout", DefaultReplayTimeout, "")
	command.Flags().BoolP("verbose", "v", false, "")
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: t.TempDir(),
		LogLevel:     LogLevelInfo,
	}))
	return command
}

func newTemplatesTestCommand(t *testing.T) *cobra.Command {
	t.Helper()
	command := &cobra.Command{Use: "templates"}
	command.Flags().String("templates-dir", "", "")
	command.Flags().String("provider", "", "")
	command.Flags().Bool("refresh", false, "")
	command.Flags().Bool("all", false, "")
	command.Flags().Bool("force", false, "")
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: t.TempDir(),
		LogLevel:     LogLevelInfo,
	}))
	return command
}
