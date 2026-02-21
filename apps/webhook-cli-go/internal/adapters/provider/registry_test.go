package provider

import (
	"testing"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

func TestRegistryDetectAcceptsZeroConfidenceMatch(t *testing.T) {
	registry := NewRegistry(
		detectorStub{
			result: domain.DetectionResult{
				Provider:   domain.ProviderGitHub,
				Confidence: 0,
			},
			matched: true,
		},
	)

	result := registry.Detect(domain.DetectionContext{})
	if result.Provider != domain.ProviderGitHub {
		t.Fatalf("expected provider %q, got %q", domain.ProviderGitHub, result.Provider)
	}
	if result.Confidence != 0 {
		t.Fatalf("expected confidence 0, got %f", result.Confidence)
	}
}

func TestRegistryDetectPrefersHigherConfidenceMatch(t *testing.T) {
	registry := NewRegistry(
		detectorStub{
			result: domain.DetectionResult{
				Provider:   domain.ProviderUnknown,
				Confidence: 0,
			},
			matched: true,
		},
		detectorStub{
			result: domain.DetectionResult{
				Provider:   domain.ProviderGitHub,
				Confidence: 0.8,
			},
			matched: true,
		},
	)

	result := registry.Detect(domain.DetectionContext{})
	if result.Provider != domain.ProviderGitHub {
		t.Fatalf("expected provider %q, got %q", domain.ProviderGitHub, result.Provider)
	}
	if result.Confidence != 0.8 {
		t.Fatalf("expected confidence 0.8, got %f", result.Confidence)
	}
}

type detectorStub struct {
	result  domain.DetectionResult
	matched bool
}

func (d detectorStub) Detect(domain.DetectionContext) (domain.DetectionResult, bool) {
	return d.result, d.matched
}
