package httpurl

import "testing"

func TestValidateAbsoluteAcceptsHTTPAndHTTPS(t *testing.T) {
	valid := []string{
		"http://localhost:3000",
		"https://example.com/hooks/github",
	}
	for _, rawURL := range valid {
		if err := ValidateAbsolute(rawURL); err != nil {
			t.Fatalf("expected %q to be valid, got error: %v", rawURL, err)
		}
	}
}

func TestValidateAbsoluteRejectsMissingSchemeOrHost(t *testing.T) {
	invalid := []string{
		"localhost:3000",
		"http:///no-host",
		"/relative/path",
	}
	for _, rawURL := range invalid {
		if err := ValidateAbsolute(rawURL); err == nil {
			t.Fatalf("expected %q to be rejected", rawURL)
		}
	}
}

func TestValidateAbsoluteRejectsUnsupportedSchemes(t *testing.T) {
	invalid := []string{
		"ftp://example.com/hook",
		"file://localhost/etc/hosts",
		"ws://example.com/socket",
	}
	for _, rawURL := range invalid {
		if err := ValidateAbsolute(rawURL); err == nil {
			t.Fatalf("expected %q to be rejected", rawURL)
		}
	}
}
