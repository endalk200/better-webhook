package github

import (
	"testing"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

func TestGitHubDetectorWithSignatureHeaders(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "X-GitHub-Event", Value: "push"},
		},
		Body: []byte(`{"zen":"keep it logically awesome"}`),
	})

	if !matched {
		t.Fatalf("expected detector to match GitHub request")
	}
	if result.Provider != domain.ProviderGitHub {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderGitHub)
	}
	if result.Confidence != 1.0 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 1.0)
	}
}

func TestGitHubDetectorWithSignature256Header(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "X-Hub-Signature-256", Value: "sha256=abc123"},
		},
		Body: []byte(`{"action":"opened"}`),
	})

	if !matched {
		t.Fatalf("expected detector to match GitHub request via signature header")
	}
	if result.Provider != domain.ProviderGitHub {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderGitHub)
	}
	if result.Confidence != 1.0 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 1.0)
	}
}

func TestGitHubDetectorWithHookshotUserAgent(t *testing.T) {
	detector := NewDetector()
	result, matched := detector.Detect(domain.DetectionContext{
		Method: "POST",
		Path:   "/webhooks",
		Headers: []domain.HeaderEntry{
			{Key: "User-Agent", Value: "GitHub-Hookshot/abc123"},
		},
		Body: []byte(`{"action":"opened"}`),
	})

	if !matched {
		t.Fatalf("expected detector to match GitHub request via user-agent header")
	}
	if result.Provider != domain.ProviderGitHub {
		t.Fatalf("provider mismatch: got %q want %q", result.Provider, domain.ProviderGitHub)
	}
	if result.Confidence != 0.8 {
		t.Fatalf("confidence mismatch: got %v want %v", result.Confidence, 0.8)
	}
}

func TestGitHubDetectorRejectsUnknownTraffic(t *testing.T) {
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
