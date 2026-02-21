package logging

import "testing"

func TestSanitizeForLogStripsControlCharacters(t *testing.T) {
	input := "\nhello\tworld\r"
	got := SanitizeForLog(input)
	if got != "hello world" {
		t.Fatalf("unexpected sanitized output: got %q", got)
	}
}

func TestTruncateForLogHonorsLimit(t *testing.T) {
	got := TruncateForLog("abcdef", 3)
	if got != "abc..." {
		t.Fatalf("unexpected truncated output: got %q", got)
	}

	unchanged := TruncateForLog("abcdef", 20)
	if unchanged != "abcdef" {
		t.Fatalf("expected value to remain unchanged, got %q", unchanged)
	}
}
