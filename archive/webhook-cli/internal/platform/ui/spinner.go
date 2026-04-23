package ui

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/mattn/go-isatty"
)

type SpinnerOption func(*spinnerConfig)

type spinnerConfig struct {
	printCompletion bool
	renderPredicate func(io.Writer) bool
}

func defaultSpinnerConfig() spinnerConfig {
	return spinnerConfig{
		printCompletion: true,
		renderPredicate: shouldRenderSpinner,
	}
}

// WithoutSpinnerCompletion sets printCompletion to false.
// The cleanup sequence ("\r\033[2K") leaves the cursor at column 0 without a
// trailing newline, so callers opting into WithoutSpinnerCompletion must print
// the next newline before additional output.
func WithoutSpinnerCompletion() SpinnerOption {
	return func(config *spinnerConfig) {
		config.printCompletion = false
	}
}

func withSpinnerRenderPredicate(predicate func(io.Writer) bool) SpinnerOption {
	return func(config *spinnerConfig) {
		config.renderPredicate = predicate
	}
}

func WithSpinner(ctx context.Context, title string, out io.Writer, action func(ctx context.Context) error, options ...SpinnerOption) error {
	if action == nil {
		return fmt.Errorf("action is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if out == nil {
		out = os.Stdout
	}
	config := defaultSpinnerConfig()
	for _, option := range options {
		if option == nil {
			continue
		}
		option(&config)
	}
	if config.renderPredicate == nil {
		config.renderPredicate = shouldRenderSpinner
	}
	if !config.renderPredicate(out) {
		return action(ctx)
	}

	done := make(chan error, 1)
	go func() {
		done <- action(ctx)
	}()

	ticker := time.NewTicker(80 * time.Millisecond)
	defer ticker.Stop()
	frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	frameIndex := 0

	for {
		select {
		case <-ctx.Done():
			if config.printCompletion {
				_, _ = fmt.Fprint(out, "\r\033[2K")
				_, _ = fmt.Fprintf(out, "\r%s %s\n", ErrorIcon, title)
				return ctx.Err()
			}
			_, _ = fmt.Fprint(out, "\r\033[2K")
			return ctx.Err()
		case err := <-done:
			if err != nil {
				_, _ = fmt.Fprint(out, "\r\033[2K")
				_, _ = fmt.Fprintf(out, "\r%s %s\n", ErrorIcon, title)
				return err
			}
			if config.printCompletion {
				_, _ = fmt.Fprint(out, "\r\033[2K")
				_, _ = fmt.Fprintf(out, "\r%s %s\n", SuccessIcon, title)
				return nil
			}
			_, _ = fmt.Fprint(out, "\r\033[2K")
			return nil
		case <-ticker.C:
			frame := Info.Render(frames[frameIndex%len(frames)])
			_, _ = fmt.Fprintf(out, "\r%s %s", frame, title)
			frameIndex++
		}
	}
}

func shouldRenderSpinner(out io.Writer) bool {
	outFile, ok := out.(*os.File)
	if !ok {
		return false
	}
	fd := outFile.Fd()
	return (isatty.IsTerminal(fd) || isatty.IsCygwinTerminal(fd)) && os.Getenv("TERM") != "dumb"
}
