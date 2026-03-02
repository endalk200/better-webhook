package runtime

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
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

func TestResolveReplayArgsRejectsUnsupportedTargetURLScheme(t *testing.T) {
	command := newReplayTestCommand(t)
	_, err := ResolveReplayArgs(command, []string{"deadbeef", "ftp://localhost:5000/hook"})
	if err == nil {
		t.Fatalf("expected unsupported target URL scheme error")
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

func TestResolveReplayArgsRejectsUnsupportedBaseURLScheme(t *testing.T) {
	command := newReplayTestCommand(t)
	if err := command.Flags().Set("base-url", "ftp://localhost:3000"); err != nil {
		t.Fatalf("set base-url: %v", err)
	}
	_, err := ResolveReplayArgs(command, []string{"deadbeef"})
	if err == nil {
		t.Fatalf("expected unsupported base URL scheme error")
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
	if args.Local {
		t.Fatalf("expected local false")
	}
	if args.TemplatesDir == "" {
		t.Fatalf("expected templates dir")
	}
}

func TestResolveTemplatesListArgsRejectsRefreshWithLocal(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("refresh", "true"); err != nil {
		t.Fatalf("set refresh: %v", err)
	}
	if err := command.Flags().Set("local", "true"); err != nil {
		t.Fatalf("set local: %v", err)
	}

	_, err := ResolveTemplatesListArgs(command)
	if err == nil {
		t.Fatalf("expected refresh/local validation error")
	}
	if !strings.Contains(err.Error(), "cannot use --refresh with --local") {
		t.Fatalf("unexpected error: %v", err)
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

func TestResolveTemplatesDownloadArgsRejectsAllWithTemplateID(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("all", "true"); err != nil {
		t.Fatalf("set all: %v", err)
	}
	_, err := ResolveTemplatesDownloadArgs(command, []string{"github-push"})
	if err == nil {
		t.Fatalf("expected mutually exclusive --all and template id to fail")
	}
	if !strings.Contains(err.Error(), "cannot be provided with --all") {
		t.Fatalf("unexpected error: %v", err)
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

func TestResolveTemplatesDeleteArgsParsesTemplateIDAndForce(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("force", "true"); err != nil {
		t.Fatalf("set force: %v", err)
	}
	args, err := ResolveTemplatesDeleteArgs(command, " github-push ")
	if err != nil {
		t.Fatalf("resolve templates delete args: %v", err)
	}
	if args.TemplateID != "github-push" {
		t.Fatalf("template id mismatch: got %q", args.TemplateID)
	}
	if !args.Force {
		t.Fatalf("expected force true")
	}
	if args.TemplatesDir == "" {
		t.Fatalf("expected templates dir")
	}
}

func TestResolveTemplatesDeleteArgsRejectsEmptyTemplateID(t *testing.T) {
	command := newTemplatesTestCommand(t)
	_, err := ResolveTemplatesDeleteArgs(command, "   ")
	if err == nil {
		t.Fatalf("expected delete template id validation error")
	}
	if !errors.Is(err, domain.ErrInvalidTemplateID) {
		t.Fatalf("expected ErrInvalidTemplateID, got %v", err)
	}
	if !strings.Contains(err.Error(), "template id cannot be empty") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesRunArgsParsesFlagsAndArguments(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("secret", "shhh"); err != nil {
		t.Fatalf("set secret: %v", err)
	}
	if err := command.Flags().Set("allow-env-placeholders", "true"); err != nil {
		t.Fatalf("set allow-env-placeholders: %v", err)
	}
	if err := command.Flags().Set("header", "X-Test: one"); err != nil {
		t.Fatalf("set header: %v", err)
	}
	if err := command.Flags().Set("timeout", "45s"); err != nil {
		t.Fatalf("set timeout: %v", err)
	}
	if err := command.Flags().Set("verbose", "true"); err != nil {
		t.Fatalf("set verbose: %v", err)
	}

	args, err := ResolveTemplatesRunArgs(command, []string{"github-push", "http://localhost:4000/hook"})
	if err != nil {
		t.Fatalf("resolve templates run args: %v", err)
	}
	if args.TemplateID != "github-push" {
		t.Fatalf("template id mismatch: got %q", args.TemplateID)
	}
	if args.TargetURL != "http://localhost:4000/hook" {
		t.Fatalf("target URL mismatch: got %q", args.TargetURL)
	}
	if args.Secret != "shhh" {
		t.Fatalf("secret mismatch: got %q", args.Secret)
	}
	if !args.AllowEnvPlaceholders {
		t.Fatalf("expected allow env placeholders true")
	}
	if args.Timeout != 45*time.Second {
		t.Fatalf("timeout mismatch: got %s", args.Timeout)
	}
	if !args.Verbose {
		t.Fatalf("expected verbose true")
	}
	if len(args.HeaderOverrides) != 1 {
		t.Fatalf("expected one header override, got %d", len(args.HeaderOverrides))
	}
}

func TestResolveTemplatesRunArgsRequiresTemplateID(t *testing.T) {
	command := newTemplatesTestCommand(t)
	_, err := ResolveTemplatesRunArgs(command, nil)
	if err == nil {
		t.Fatalf("expected template id validation error")
	}
	if !strings.Contains(err.Error(), "template id is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesRunArgsRejectsTooManyArguments(t *testing.T) {
	command := newTemplatesTestCommand(t)
	_, err := ResolveTemplatesRunArgs(command, []string{"github-push", "http://localhost:4000/hook", "extra"})
	if err == nil {
		t.Fatalf("expected too many arguments error")
	}
	if !strings.Contains(err.Error(), "too many arguments") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesRunArgsRejectsWhitespaceTemplateID(t *testing.T) {
	command := newTemplatesTestCommand(t)
	_, err := ResolveTemplatesRunArgs(command, []string{"   "})
	if err == nil {
		t.Fatalf("expected template id validation error")
	}
	if !strings.Contains(err.Error(), "template id cannot be empty") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesRunArgsAllowsMissingTargetURL(t *testing.T) {
	command := newTemplatesTestCommand(t)
	args, err := ResolveTemplatesRunArgs(command, []string{"github-push"})
	if err != nil {
		t.Fatalf("resolve templates run args: %v", err)
	}
	if args.TargetURL != "" {
		t.Fatalf("expected empty target URL when omitted, got %q", args.TargetURL)
	}
}

func TestResolveTemplatesRunArgsUsesVerboseFlagPrecedence(t *testing.T) {
	command := newTemplatesTestCommand(t)
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: t.TempDir(),
		LogLevel:     LogLevelInfo,
	}))
	if err := command.Flags().Set("verbose", "true"); err != nil {
		t.Fatalf("set verbose flag: %v", err)
	}

	args, err := ResolveTemplatesRunArgs(command, []string{"github-push"})
	if err != nil {
		t.Fatalf("resolve templates run args: %v", err)
	}
	if !args.Verbose {
		t.Fatalf("expected explicit --verbose flag to enable verbose output")
	}
}

func TestResolveTemplatesRunArgsRejectsInvalidTargetURL(t *testing.T) {
	command := newTemplatesTestCommand(t)
	_, err := ResolveTemplatesRunArgs(command, []string{"github-push", "not-a-url"})
	if err == nil {
		t.Fatalf("expected invalid target URL error")
	}
	if !strings.Contains(err.Error(), "target URL is invalid") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesRunArgsRejectsInvalidHeaderOverride(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("header", "invalid-header"); err != nil {
		t.Fatalf("set header: %v", err)
	}
	_, err := ResolveTemplatesRunArgs(command, []string{"github-push"})
	if err == nil {
		t.Fatalf("expected invalid header override error")
	}
	if !strings.Contains(err.Error(), "key:value") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTemplatesRunArgsRejectsNonPositiveTimeout(t *testing.T) {
	command := newTemplatesTestCommand(t)
	if err := command.Flags().Set("timeout", "0s"); err != nil {
		t.Fatalf("set timeout: %v", err)
	}
	_, err := ResolveTemplatesRunArgs(command, []string{"github-push"})
	if err == nil {
		t.Fatalf("expected timeout validation error")
	}
	if !strings.Contains(err.Error(), "timeout must be greater than 0") {
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
	command.Flags().Bool("local", false, "")
	command.Flags().Bool("all", false, "")
	command.Flags().Bool("force", false, "")
	command.Flags().String("secret", "", "")
	command.Flags().Bool("allow-env-placeholders", false, "")
	command.Flags().StringArrayP("header", "H", nil, "")
	command.Flags().Duration("timeout", DefaultTemplateRunTimeout, "")
	command.Flags().BoolP("verbose", "v", false, "")
	command.SetContext(context.WithValue(context.Background(), runtimeConfigContextKey{}, AppConfig{
		CapturesDir:  t.TempDir(),
		TemplatesDir: t.TempDir(),
		LogLevel:     LogLevelInfo,
	}))
	return command
}

func TestResolveConfigPathUsesFlagWhenProvided(t *testing.T) {
	command := &cobra.Command{Use: "root"}
	command.Flags().String("config", "", "")
	expectedPath := filepath.Join(t.TempDir(), "custom.toml")
	if err := command.Flags().Set("config", expectedPath); err != nil {
		t.Fatalf("set config flag: %v", err)
	}

	resolved, err := ResolveConfigPath(command)
	if err != nil {
		t.Fatalf("resolve config path: %v", err)
	}
	if resolved.Source != ConfigPathSourceFlag {
		t.Fatalf("source mismatch: got %q want %q", resolved.Source, ConfigPathSourceFlag)
	}
	if resolved.Path != expectedPath {
		t.Fatalf("path mismatch: got %q want %q", resolved.Path, expectedPath)
	}
}

func TestResolveConfigPathUsesEnvWhenFlagMissing(t *testing.T) {
	command := &cobra.Command{Use: "root"}
	command.Flags().String("config", "", "")
	expectedPath := filepath.Join(t.TempDir(), "env.toml")
	t.Setenv(EnvConfigPath, expectedPath)

	resolved, err := ResolveConfigPath(command)
	if err != nil {
		t.Fatalf("resolve config path: %v", err)
	}
	if resolved.Source != ConfigPathSourceEnv {
		t.Fatalf("source mismatch: got %q want %q", resolved.Source, ConfigPathSourceEnv)
	}
	if resolved.Path != expectedPath {
		t.Fatalf("path mismatch: got %q want %q", resolved.Path, expectedPath)
	}
}

func TestResolveConfigPathUsesDefaultWhenFlagAndEnvMissing(t *testing.T) {
	command := &cobra.Command{Use: "root"}

	resolved, err := ResolveConfigPath(command)
	if err != nil {
		t.Fatalf("resolve config path: %v", err)
	}
	if resolved.Source != ConfigPathSourceDefault {
		t.Fatalf("source mismatch: got %q want %q", resolved.Source, ConfigPathSourceDefault)
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("resolve home directory: %v", err)
	}
	expectedPath := DefaultConfigPath(homeDir)
	if resolved.Path != expectedPath {
		t.Fatalf("path mismatch: got %q want %q", resolved.Path, expectedPath)
	}
}

func TestResolveConfigPathPrioritizesFlagOverEnv(t *testing.T) {
	command := &cobra.Command{Use: "root"}
	command.Flags().String("config", "", "")
	flagPath := filepath.Join(t.TempDir(), "from-flag.toml")
	if err := command.Flags().Set("config", flagPath); err != nil {
		t.Fatalf("set config flag: %v", err)
	}
	t.Setenv(EnvConfigPath, filepath.Join(t.TempDir(), "from-env.toml"))

	resolved, err := ResolveConfigPath(command)
	if err != nil {
		t.Fatalf("resolve config path: %v", err)
	}
	if resolved.Source != ConfigPathSourceFlag {
		t.Fatalf("source mismatch: got %q want %q", resolved.Source, ConfigPathSourceFlag)
	}
	if resolved.Path != flagPath {
		t.Fatalf("path mismatch: got %q want %q", resolved.Path, flagPath)
	}
}

func TestResolveConfigPathRejectsEmptyEnvPath(t *testing.T) {
	command := &cobra.Command{Use: "root"}
	t.Setenv(EnvConfigPath, "   ")

	_, err := ResolveConfigPath(command)
	if err == nil {
		t.Fatalf("expected empty env config path to fail")
	}
	if !strings.Contains(err.Error(), EnvConfigPath) {
		t.Fatalf("expected env variable name in error, got %v", err)
	}
}

func TestResolveConfigPathRejectsEmptyFlagPath(t *testing.T) {
	command := &cobra.Command{Use: "root"}
	command.Flags().String("config", "", "")
	if err := command.Flags().Set("config", "   "); err != nil {
		t.Fatalf("set config flag: %v", err)
	}

	_, err := ResolveConfigPath(command)
	if err == nil {
		t.Fatalf("expected empty --config path to fail")
	}
	if !strings.Contains(err.Error(), "--config") {
		t.Fatalf("expected flag name in error, got %v", err)
	}
}

func TestInitializeConfigUsesResolvedConfigPath(t *testing.T) {
	command := &cobra.Command{Use: "root"}
	command.Flags().String("config", "", "")
	envPath := filepath.Join(t.TempDir(), "from-env.toml")
	t.Setenv(EnvConfigPath, envPath)
	loader := &captureLoader{
		config: AppConfig{
			CapturesDir:  t.TempDir(),
			TemplatesDir: t.TempDir(),
			LogLevel:     LogLevelInfo,
		},
	}

	if err := InitializeConfig(command, loader); err != nil {
		t.Fatalf("initialize config: %v", err)
	}
	if loader.receivedPath != envPath {
		t.Fatalf("loader config path mismatch: got %q want %q", loader.receivedPath, envPath)
	}
}

type captureLoader struct {
	receivedPath string
	config       AppConfig
	err          error
}

func (l *captureLoader) Load(configPath string) (AppConfig, error) {
	l.receivedPath = configPath
	if l.err != nil {
		return AppConfig{}, l.err
	}
	return l.config, nil
}
