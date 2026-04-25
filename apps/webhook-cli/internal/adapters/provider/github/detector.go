package github

import (
	"strings"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider/headers"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

type Detector struct{}

func NewDetector() Detector {
	return Detector{}
}

func (d Detector) Detect(ctx domain.DetectionContext) (domain.DetectionResult, bool) {
	if headers.HasHeader(ctx.Headers, "x-github-event") ||
		headers.HasHeader(ctx.Headers, "x-hub-signature") ||
		headers.HasHeader(ctx.Headers, "x-hub-signature-256") {
		return domain.DetectionResult{
			Provider:   domain.ProviderGitHub,
			Confidence: 1.0,
		}, true
	}

	userAgents := headers.HeaderValues(ctx.Headers, "user-agent")
	for _, ua := range userAgents {
		if strings.Contains(strings.ToLower(ua), "github-hookshot") {
			return domain.DetectionResult{
				Provider:   domain.ProviderGitHub,
				Confidence: 0.8,
			}, true
		}
	}

	return domain.DetectionResult{}, false
}
