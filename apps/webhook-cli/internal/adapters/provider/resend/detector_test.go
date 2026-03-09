package resend

import (
	"testing"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider"
	githubdetector "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider/github"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

func TestResendDetectorWithSvixHeadersAndEmailEnvelope(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "svix-id", Value: "msg_123"},
			{Key: "svix-timestamp", Value: "1730000000"},
			{Key: "svix-signature", Value: "v1,abc123"},
		},
		Body: []byte(`{"type":"email.delivered","created_at":"2024-11-22T23:41:12.126Z","data":{"email_id":"56761188-7520-42d8-8898-ff6fc54ce618","created_at":"2024-11-22T23:41:11.894719+00:00","from":"Acme <onboarding@resend.dev>","to":["delivered@resend.dev"],"subject":"Sending this example"}}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Resend request")
	}
	if result.Provider != domain.ProviderResend {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderResend)
	}
	if result.Confidence != 0.95 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.95)
	}
}

func TestResendDetectorWithPathAndDomainEnvelope(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method:  "POST",
		Path:    "/webhooks/resend",
		Headers: []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		Body:    []byte(`{"type":"domain.updated","created_at":"2024-11-17T19:32:22.980Z","data":{"id":"d91cd9bd-1176-453e-8fc1-35364d380206","name":"example.com","status":"partially_verified","created_at":"2024-04-26T20:21:26.347412+00:00","region":"us-east-1","records":[]}}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Resend path + envelope hint")
	}
	if result.Provider != domain.ProviderResend {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderResend)
	}
	if result.Confidence != 0.85 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.85)
	}
}

func TestResendDetectorWithContactEnvelopeOnly(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method:  "POST",
		Path:    "/webhooks",
		Headers: []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		Body:    []byte(`{"type":"contact.created","created_at":"2024-11-17T19:32:22.980Z","data":{"id":"e169aa45-1ecf-4183-9955-b1499d5701d3","audience_id":"78261eea-8f8b-4381-83c6-79fa7120f1cf","segment_ids":["78261eea-8f8b-4381-83c6-79fa7120f1cf"],"created_at":"2024-11-17T19:32:22.980Z","updated_at":"2024-11-17T19:32:22.980Z","email":"steve.wozniak@gmail.com","unsubscribed":false}}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Resend envelope")
	}
	if result.Provider != domain.ProviderResend {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderResend)
	}
	if result.Confidence != 0.65 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.65)
	}
}

func TestResendDetectorMatchesReceivedEmailWithEmptySubject(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "svix-id", Value: "msg_123"},
			{Key: "svix-timestamp", Value: "1730000000"},
			{Key: "svix-signature", Value: "v1,abc123"},
		},
		Body: []byte(`{"type":"email.received","created_at":"2024-11-22T23:41:12.126Z","data":{"email_id":"56761188-7520-42d8-8898-ff6fc54ce618","created_at":"2024-11-22T23:41:11.894719+00:00","from":"Acme <onboarding@resend.dev>","to":["delivered@resend.dev"],"message_id":"<example+123>","subject":""}}`),
	})

	if !matched {
		t.Fatalf("expected detector to match Resend received email with empty subject")
	}
	if result.Provider != domain.ProviderResend {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderResend)
	}
	if result.Confidence != 0.95 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.95)
	}
}

func TestResendDetectorRejectsGenericSvixTraffic(t *testing.T) {
	detector := NewDetector()
	_, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "svix-id", Value: "msg_123"},
			{Key: "svix-timestamp", Value: "1730000000"},
			{Key: "svix-signature", Value: "v1,abc123"},
		},
		Body: []byte(`{"event":"generic.created","data":{"id":"abc"}}`),
	})

	if matched {
		t.Fatalf("expected detector not to match generic Svix traffic")
	}
}

func TestResendDetectorRejectsRecallLikeSvixTraffic(t *testing.T) {
	detector := NewDetector()
	_, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "svix-id", Value: "msg_123"},
			{Key: "svix-timestamp", Value: "1730000000"},
			{Key: "svix-signature", Value: "v1,abc123"},
		},
		Body: []byte(`{"event":"bot.done","data":{"code":"done","updated_at":"2024-11-17T19:32:22.980Z"}}`),
	})

	if matched {
		t.Fatalf("expected detector not to match Recall-like Svix traffic")
	}
}

func TestResendDetectorRejectsPathOnlyHint(t *testing.T) {
	detector := NewDetector()
	_, matched := detector.Detect(domain.DetectionContext{
		Method:  "POST",
		Path:    "/webhooks/resend",
		Headers: []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		Body:    []byte(`{"event":"user.created"}`),
	})

	if matched {
		t.Fatalf("expected detector not to match Resend path-only hint")
	}
}

func TestResendDetectionLosesToGitHubWhenHeadersConflict(t *testing.T) {
	registry := provider.NewRegistry(
		githubdetector.NewDetector(),
		NewDetector(),
	)

	result := registry.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks/resend",
		Headers: []domain.HeaderEntry{
			{Key: "X-GitHub-Event", Value: "push"},
			{Key: "svix-id", Value: "msg_123"},
			{Key: "svix-timestamp", Value: "1730000000"},
			{Key: "svix-signature", Value: "v1,abc123"},
		},
		Body: []byte(`{"type":"email.delivered","created_at":"2024-11-22T23:41:12.126Z","data":{"email_id":"56761188-7520-42d8-8898-ff6fc54ce618","created_at":"2024-11-22T23:41:11.894719+00:00","from":"Acme <onboarding@resend.dev>","to":["delivered@resend.dev"],"subject":"Sending this example"}}`),
	})

	if result.Provider != domain.ProviderGitHub {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderGitHub)
	}
	if result.Confidence != 1.0 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 1.0)
	}
}
