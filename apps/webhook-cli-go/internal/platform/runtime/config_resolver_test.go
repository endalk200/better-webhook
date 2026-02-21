package runtime

import (
	"context"
	"testing"

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
