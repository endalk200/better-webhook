package ui

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/mattn/go-isatty"
)

type Prompter interface {
	Confirm(prompt string, in io.Reader, out io.Writer) (bool, error)
}

type HuhPrompter struct{}

var DefaultPrompter Prompter = HuhPrompter{}

func Confirm(prompt string) (bool, error) {
	return ConfirmWithIO(prompt, os.Stdin, os.Stdout)
}

func ConfirmWithIO(prompt string, in io.Reader, out io.Writer) (bool, error) {
	return DefaultPrompter.Confirm(prompt, in, out)
}

func (HuhPrompter) Confirm(prompt string, in io.Reader, out io.Writer) (bool, error) {
	if in == nil {
		in = os.Stdin
	}
	if out == nil {
		out = os.Stdout
	}

	if shouldUseInteractivePrompt(in, out) {
		var confirmed bool
		confirm := huh.NewConfirm().
			Title(prompt).
			Affirmative("Yes").
			Negative("No").
			Value(&confirmed)
		err := huh.NewForm(huh.NewGroup(confirm)).
			WithInput(in).
			WithOutput(out).
			Run()
		if err != nil {
			return false, err
		}
		return confirmed, nil
	}

	return confirmPlain(prompt, in, out)
}

func shouldUseInteractivePrompt(in io.Reader, out io.Writer) bool {
	inFile, inIsFile := in.(*os.File)
	outFile, outIsFile := out.(*os.File)
	if !inIsFile || !outIsFile {
		return false
	}
	if inFile != os.Stdin || !isSupportedPromptOutput(outFile) {
		return false
	}
	return isatty.IsTerminal(inFile.Fd()) && isatty.IsTerminal(outFile.Fd()) && os.Getenv("TERM") != "dumb"
}

func isSupportedPromptOutput(out *os.File) bool {
	return out == os.Stdout || out == os.Stderr
}

func confirmPlain(prompt string, in io.Reader, out io.Writer) (bool, error) {
	reader := bufio.NewReader(in)

	if _, err := fmt.Fprintf(out, "%s [y/N]: ", prompt); err != nil {
		return false, err
	}

	for {
		line, readErr := reader.ReadString('\n')
		if readErr != nil && !errors.Is(readErr, io.EOF) {
			return false, readErr
		}

		answer := strings.ToLower(strings.TrimSpace(line))
		switch answer {
		case "y", "yes":
			return true, nil
		case "", "n", "no":
			return false, nil
		}

		if errors.Is(readErr, io.EOF) {
			return false, nil
		}

		if _, err := fmt.Fprintln(out, FormatWarning("Please answer yes or no.")); err != nil {
			return false, err
		}
		if _, err := fmt.Fprintf(out, "%s [y/N]: ", prompt); err != nil {
			return false, err
		}
	}
}
