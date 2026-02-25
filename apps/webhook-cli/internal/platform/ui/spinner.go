package ui

import (
	"fmt"
	"io"
	"os"
	"time"

	"github.com/mattn/go-isatty"
)

func WithSpinner(title string, out io.Writer, action func() error) error {
	if action == nil {
		return fmt.Errorf("action is nil")
	}
	if out == nil {
		out = os.Stdout
	}
	if !shouldRenderSpinner(out) {
		return action()
	}

	done := make(chan error, 1)
	go func() {
		done <- action()
	}()

	ticker := time.NewTicker(80 * time.Millisecond)
	defer ticker.Stop()
	frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	frameIndex := 0

	for {
		select {
		case err := <-done:
			if err != nil {
				_, _ = fmt.Fprintf(out, "\r%s %s\n", ErrorIcon, title)
				return err
			}
			_, _ = fmt.Fprintf(out, "\r%s %s\n", SuccessIcon, title)
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
	return isatty.IsTerminal(outFile.Fd()) && os.Getenv("TERM") != "dumb"
}
