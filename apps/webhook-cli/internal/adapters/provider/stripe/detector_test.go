package stripe

import (
	"testing"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider"
	githubdetector "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider/github"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

func TestStripeDetectorWithSignatureHeader(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "Stripe-Signature", Value: "t=1730000000,v1=abc"},
		},
		Body: []byte(`{"id":"evt_123","type":"charge.failed"}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Stripe request")
	}
	if result.Provider != domain.ProviderStripe {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderStripe)
	}
	if result.Confidence != 1.0 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 1.0)
	}
}

func TestStripeDetectorWithUserAgent(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "User-Agent", Value: "Stripe/1.0 (+https://stripe.com/docs/webhooks)"},
		},
		Body: []byte(`{"id":"evt_123","type":"charge.failed"}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Stripe user agent")
	}
	if result.Provider != domain.ProviderStripe {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderStripe)
	}
	if result.Confidence != 0.55 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.55)
	}
}

func TestStripeDetectorRejectsPathOnlyHint(t *testing.T) {
	detector := NewDetector()
	_, matched := detector.Detect(domain.DetectionContext{
		Method:  "POST",
		Path:    "/webhooks/stripe",
		Headers: []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		Body:    []byte(`{"event":"user.created"}`),
	})

	if matched {
		t.Fatalf("expected detector not to match Stripe path-only hint")
	}
}

func TestStripeDetectorWithPathAndUserAgentHint(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks/stripe",
		Headers: []domain.HeaderEntry{
			{Key: "User-Agent", Value: "Stripe/1.0 (+https://stripe.com/docs/webhooks)"},
		},
		Body: []byte(`{"event":"not-a-stripe-envelope"}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Stripe path + user-agent hints")
	}
	if result.Provider != domain.ProviderStripe {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderStripe)
	}
	if result.Confidence != 0.75 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.75)
	}
}

func TestStripeDetectorWithStripeEventEnvelopeHint(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method:  "POST",
		Path:    "/webhooks",
		Headers: []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		Body:    []byte(`{"id":"evt_123","object":"event","type":"charge.failed"}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Stripe event envelope hint")
	}
	if result.Provider != domain.ProviderStripe {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderStripe)
	}
	if result.Confidence != 0.5 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.5)
	}
}

func TestStripeDetectorRejectsGenericUserAgentSubstring(t *testing.T) {
	detector := NewDetector()
	_, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks/stripe",
		Headers: []domain.HeaderEntry{
			{Key: "User-Agent", Value: "my-stripe-webhook-processor/1.0"},
		},
		Body: []byte(`{"event":"not-a-stripe-envelope"}`),
	})

	if matched {
		t.Fatalf("expected detector not to match generic user agent substring")
	}
}

func TestStripeDetectorRejectsUnknownTraffic(t *testing.T) {
	detector := NewDetector()
	_, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "Content-Type", Value: "application/json"},
		},
		Body: []byte(`{"event":"user.created"}`),
	})

	if matched {
		t.Fatalf("expected detector not to match generic request")
	}
}

func TestStripeDetectionLosesToGitHubWhenHeadersConflict(t *testing.T) {
	registry := provider.NewRegistry(
		githubdetector.NewDetector(),
		NewDetector(),
	)

	result := registry.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks/stripe",
		Headers: []domain.HeaderEntry{
			{Key: "X-GitHub-Event", Value: "push"},
			{Key: "User-Agent", Value: "Stripe/1.0 (+https://stripe.com/docs/webhooks)"},
		},
		Body: []byte(`{"id":"evt_123","object":"event","type":"charge.failed"}`),
	})

	if result.Provider != domain.ProviderGitHub {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderGitHub)
	}
	if result.Confidence != 1.0 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 1.0)
	}
}
