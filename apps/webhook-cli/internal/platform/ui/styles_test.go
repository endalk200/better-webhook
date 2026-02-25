package ui

import "testing"

func TestMethodStyleNormalizesMethodCasing(t *testing.T) {
	expected := MethodStyle("GET").Render("sample")

	lower := MethodStyle("get").Render("sample")
	if lower != expected {
		t.Fatalf("expected lower-case method to match GET style")
	}

	mixed := MethodStyle("GeT").Render("sample")
	if mixed != expected {
		t.Fatalf("expected mixed-case method to match GET style")
	}
}
