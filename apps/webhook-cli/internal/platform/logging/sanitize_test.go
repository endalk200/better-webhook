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
	tests := []struct {
		name      string
		input     string
		maxLength int
		want      string
	}{
		{name: "zero length returns input unchanged", input: "abc", maxLength: 0, want: "abc"},
		{name: "negative length returns input unchanged", input: "abc", maxLength: -1, want: "abc"},
		{name: "exact boundary returns input unchanged", input: "abc", maxLength: 3, want: "abc"},
		{name: "truncates without ellipsis when limit is tiny", input: "abcdef", maxLength: 3, want: "abc"},
		{name: "preserves ellipsis for wider limits", input: "abcdef", maxLength: 5, want: "ab..."},
		{name: "unicode is truncated by runes", input: "héllo", maxLength: 3, want: "hél"},
	}

	for _, test := range tests {
		got := TruncateForLog(test.input, test.maxLength)
		if got != test.want {
			t.Fatalf("%s: unexpected output: got %q want %q", test.name, got, test.want)
		}
		if test.maxLength > 0 && len([]rune(got)) > test.maxLength {
			t.Fatalf("%s: expected output within max length, got %q", test.name, got)
		}
	}
}
