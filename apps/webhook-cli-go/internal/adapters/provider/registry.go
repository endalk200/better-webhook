package provider

import domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"

type Detector interface {
	Detect(ctx domain.DetectionContext) (domain.DetectionResult, bool)
}

type Registry struct {
	detectors []Detector
}

func NewRegistry(detectors ...Detector) *Registry {
	return &Registry{detectors: detectors}
}

func (r *Registry) Detect(ctx domain.DetectionContext) domain.DetectionResult {
	best := domain.DetectionResult{Provider: domain.ProviderUnknown}

	for _, detector := range r.detectors {
		result, matched := detector.Detect(ctx)
		if !matched {
			continue
		}
		if result.Confidence > best.Confidence {
			best = result
		}
	}

	if best.Provider == "" {
		best.Provider = domain.ProviderUnknown
	}

	return best
}
