package httprequest

import "testing"

func TestShouldSkipHopByHopHeader(t *testing.T) {
	if !ShouldSkipHopByHopHeader("Connection") {
		t.Fatalf("expected connection to be skipped")
	}
	if ShouldSkipHopByHopHeader("X-Custom") {
		t.Fatalf("expected custom header to be retained")
	}
}

func TestApplyHeaderOverridesReplacesAndAppends(t *testing.T) {
	base := []HeaderEntry{
		{Key: "X-One", Value: "1"},
		{Key: "X-Two", Value: "2"},
		{Key: "Connection", Value: "keep-alive"},
	}
	overrides := []HeaderEntry{
		{Key: "X-Two", Value: "updated"},
		{Key: "X-Three", Value: "3"},
		{Key: "Connection", Value: "close"},
	}

	merged := ApplyHeaderOverrides(base, overrides)
	if len(merged) != 4 {
		t.Fatalf("expected 4 headers after merge, got %d", len(merged))
	}

	if merged[0].Key != "X-One" || merged[0].Value != "1" {
		t.Fatalf("first header mismatch: %#v", merged[0])
	}
	if merged[1].Key != "X-Two" || merged[1].Value != "updated" {
		t.Fatalf("overridden header mismatch: %#v", merged[1])
	}
	if merged[2].Key != "Connection" || merged[2].Value != "keep-alive" {
		t.Fatalf("base hop-by-hop header should remain untouched unless filtered by caller: %#v", merged[2])
	}
	if merged[3].Key != "X-Three" || merged[3].Value != "3" {
		t.Fatalf("appended header mismatch: %#v", merged[3])
	}
}

func TestApplyHeaderOverridesPreservesDuplicateHeaderCount(t *testing.T) {
	base := []HeaderEntry{
		{Key: "X-Multi", Value: "one"},
		{Key: "X-Multi", Value: "two"},
	}
	overrides := []HeaderEntry{
		{Key: "X-Multi", Value: "updated"},
	}

	merged := ApplyHeaderOverrides(base, overrides)
	if len(merged) != 2 {
		t.Fatalf("expected duplicate header count to be preserved, got %d", len(merged))
	}
	for idx, header := range merged {
		if header.Key != "X-Multi" || header.Value != "updated" {
			t.Fatalf("merged header %d mismatch: %#v", idx, header)
		}
	}
}

func TestIsValidHTTPMethod(t *testing.T) {
	if !IsValidHTTPMethod("POST") {
		t.Fatalf("expected POST to be valid")
	}
	if !IsValidHTTPMethod("M-SEARCH") {
		t.Fatalf("expected token punctuation in method to be valid")
	}
	if IsValidHTTPMethod("") {
		t.Fatalf("expected empty method to be invalid")
	}
	if IsValidHTTPMethod("BAD METHOD") {
		t.Fatalf("expected whitespace in method to be invalid")
	}
}
