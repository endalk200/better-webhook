package provider

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

func TestStripeSigningUsesTimestampDotRawBody(t *testing.T) {
	t.Setenv("STRIPE_SECRET", "whsec_test")
	body := []byte(`{"id":"evt_1"}`)
	headers, err := NewRegistry().Sign(SigningContext{
		Endpoint: domain.EndpointProfile{
			ID:       "stripe-main",
			Mode:     domain.EndpointModeProvider,
			Provider: "stripe",
			Secret:   domain.ProviderSecret{Env: "STRIPE_SECRET"},
		},
		Body: body,
		Headers: []domain.Header{
			{Name: "Stripe-Signature", Value: "old"},
			{Name: "Content-Type", Value: "application/json"},
		},
		Now: time.Unix(1_700_000_000, 0),
	})
	if err != nil {
		t.Fatalf("expected signing to succeed: %v", err)
	}

	signature := headerValue(headers, "Stripe-Signature")
	expected := hmacSHA256("whsec_test", []byte(`1700000000.`), body)
	if signature != "t=1700000000,v1="+expected {
		t.Fatalf("unexpected stripe signature %q", signature)
	}
	if strings.Contains(strings.Join(headerValues(headers), ","), "old") {
		t.Fatalf("expected stale signature header to be replaced: %#v", headers)
	}
}

func TestGitHubSigningUsesRawBody(t *testing.T) {
	t.Setenv("GITHUB_SECRET", "github_secret")
	body := []byte(`{"zen":"test"}`)
	headers, err := NewRegistry().Sign(SigningContext{
		Endpoint: domain.EndpointProfile{
			ID:       "github-main",
			Mode:     domain.EndpointModeProvider,
			Provider: "github",
			Secret:   domain.ProviderSecret{Env: "GITHUB_SECRET"},
		},
		Body: body,
	})
	if err != nil {
		t.Fatalf("expected signing to succeed: %v", err)
	}
	expected := hmacSHA256("github_secret", body)
	if headerValue(headers, "X-Hub-Signature-256") != "sha256="+expected {
		t.Fatalf("unexpected GitHub signature headers: %#v", headers)
	}
	if headerValue(headers, "X-GitHub-Delivery") == "" {
		t.Fatalf("expected GitHub delivery id to be generated: %#v", headers)
	}
}

func TestAnalyzeWarnsWhenDetectedProviderDiffersFromRouteOwner(t *testing.T) {
	analysis := Analyze(domain.EndpointProfile{
		ID:       "stripe-main",
		Mode:     domain.EndpointModeProvider,
		Provider: "stripe",
	}, []domain.Header{
		{Name: "X-GitHub-Event", Value: "ping"},
		{Name: "X-Hub-Signature-256", Value: "sha256=abc123"},
	})

	if !analysis.ProviderDetected || analysis.DetectedProvider != "github" {
		t.Fatalf("expected GitHub detection, got %#v", analysis)
	}
	if len(analysis.Warnings) != 1 || !strings.Contains(analysis.Warnings[0], `route belongs to provider "stripe"`) {
		t.Fatalf("expected provider mismatch warning, got %#v", analysis.Warnings)
	}
	if len(analysis.Capabilities) != 1 || analysis.Capabilities[0] != string(domain.ReplayModeExact) {
		t.Fatalf("expected mismatch to advertise exact replay only, got %#v", analysis.Capabilities)
	}
}

func hmacSHA256(secret string, values ...[]byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	for _, value := range values {
		mac.Write(value)
	}
	return hex.EncodeToString(mac.Sum(nil))
}

func headerValue(headers []domain.Header, name string) string {
	for _, header := range headers {
		if strings.EqualFold(header.Name, name) {
			return header.Value
		}
	}
	return ""
}

func headerValues(headers []domain.Header) []string {
	values := make([]string, 0, len(headers))
	for _, header := range headers {
		values = append(values, header.Value)
	}
	return values
}
