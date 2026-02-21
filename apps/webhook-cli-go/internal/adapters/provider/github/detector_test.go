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
