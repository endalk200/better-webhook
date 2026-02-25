package ui

import "testing"

func TestMethodStyleNormalizesMethodCasing(t *testing.T) {
	testCases := []struct {
		name  string
		input string
	}{
		{name: "upper", input: "GET"},
		{name: "lower", input: "get"},
		{name: "mixed", input: "GeT"},
	}

	expected := MethodStyle("GET").Render("sample")

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			rendered := MethodStyle(testCase.input).Render("sample")
			if rendered != expected {
				t.Fatalf("rendered = %q; expected = %q", rendered, expected)
			}
		})
	}
}
