package ui

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
)

func FormatMethod(method string) string {
	return MethodStyle(method).Render(method)
}

func FormatStatusCode(code int, text string) string {
	return StatusCodeStyle(code).Render(fmt.Sprintf("%d %s", code, text))
}

func FormatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return Muted.Render(d.String())
	}
	return Muted.Render(d.Round(time.Millisecond).String())
}

func FormatProvider(name string) string {
	if name == "" {
		name = "unknown"
	}
	return Muted.Render(name)
}

func FormatBodyPreview(body []byte, truncated bool) string {
	preview := string(body)
	var parsed interface{}
	if json.Unmarshal(body, &parsed) == nil {
		if formatted, err := json.MarshalIndent(parsed, "", "  "); err == nil {
			preview = string(formatted)
		}
	}
	preview = sanitizeForTerminal(preview)

	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("8")).
		Padding(0, 1)

	if truncated {
		preview += "\n" + Muted.Render("... (truncated)")
	}

	return style.Render(preview)
}

func FormatSuccess(message string) string {
	return fmt.Sprintf("%s %s", SuccessIcon, message)
}

func FormatWarning(message string) string {
	return fmt.Sprintf("%s %s", WarningIcon, Warning.Render(message))
}

func FormatInfo(message string) string {
	return fmt.Sprintf("%s %s", InfoIcon, message)
}

func FormatCancelled() string {
	return Muted.Render("Cancelled.")
}

func sanitizeForTerminal(text string) string {
	plainText := ansi.Strip(text)
	var sanitized strings.Builder
	sanitized.Grow(len(plainText))
	for _, r := range plainText {
		if r == '\n' || r == '\t' {
			sanitized.WriteRune(r)
			continue
		}
		if r < 0x20 || r == 0x7f {
			sanitized.WriteString(fmt.Sprintf("\\x%02x", r))
			continue
		}
		sanitized.WriteRune(r)
	}
	return sanitized.String()
}
