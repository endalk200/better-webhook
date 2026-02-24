package github

import (
	"strings"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

type Detector struct{}

func NewDetector() Detector {
	return Detector{}
}

func (d Detector) Detect(ctx domain.DetectionContext) (domain.DetectionResult, bool) {
	if hasHeader(ctx.Headers, "x-github-event") ||
		hasHeader(ctx.Headers, "x-hub-signature") ||
		hasHeader(ctx.Headers, "x-hub-signature-256") {
		return domain.DetectionResult{
			Provider:   domain.ProviderGitHub,
			Confidence: 1.0,
		}, true
	}

	userAgents := headerValues(ctx.Headers, "user-agent")
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

func hasHeader(headers []domain.HeaderEntry, key string) bool {
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			return true
		}
	}
	return false
}

func headerValues(headers []domain.HeaderEntry, key string) []string {
	values := make([]string, 0)
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			values = append(values, header.Value)
		}
	}
	return values
}
