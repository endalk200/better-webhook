package logging

import (
	"strings"
	"unicode"
)

// SanitizeForLog replaces control characters with spaces and trims leading and
// trailing whitespace from the final value.
func SanitizeForLog(value string) string {
	var b strings.Builder
	b.Grow(len(value))
	for _, r := range value {
		if unicode.IsControl(r) {
			b.WriteRune(' ')
			continue
		}
		b.WriteRune(r)
	}
	return strings.TrimSpace(b.String())
}

func TruncateForLog(value string, maxLength int) string {
	if maxLength <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= maxLength {
		return value
	}
	const ellipsis = "..."
	if maxLength <= len(ellipsis) {
		return string(runes[:maxLength])
	}
	return string(runes[:maxLength-len(ellipsis)]) + ellipsis
}
