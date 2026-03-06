package stripe

import (
	"bytes"
	"encoding/json"
	"strings"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider/headers"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

type Detector struct{}

func NewDetector() Detector {
	return Detector{}
}

func (d Detector) Detect(ctx domain.DetectionContext) (domain.DetectionResult, bool) {
	if headers.HasHeader(ctx.Headers, "stripe-signature") {
		return domain.DetectionResult{
			Provider:   domain.ProviderStripe,
			Confidence: 1.0,
		}, true
	}

	containsStripePath := strings.Contains(strings.ToLower(ctx.Path), "stripe")
	containsStripeUA := hasStripeUserAgent(ctx.Headers)
	looksLikeStripe := looksLikeStripeEvent(ctx.Body)

	switch {
	case containsStripeUA && looksLikeStripe:
		return domain.DetectionResult{
			Provider:   domain.ProviderStripe,
			Confidence: 0.85,
		}, true
	case containsStripeUA && containsStripePath:
		return domain.DetectionResult{
			Provider:   domain.ProviderStripe,
			Confidence: 0.75,
		}, true
	case containsStripePath && looksLikeStripe:
		return domain.DetectionResult{
			Provider:   domain.ProviderStripe,
			Confidence: 0.65,
		}, true
	case containsStripeUA:
		return domain.DetectionResult{
			Provider:   domain.ProviderStripe,
			Confidence: 0.55,
		}, true
	case looksLikeStripe:
		return domain.DetectionResult{
			Provider:   domain.ProviderStripe,
			Confidence: 0.5,
		}, true
	default:
		return domain.DetectionResult{}, false
	}
}

func hasStripeUserAgent(headerEntries []domain.HeaderEntry) bool {
	userAgents := headers.HeaderValues(headerEntries, "user-agent")
	for _, ua := range userAgents {
		if strings.Contains(strings.ToLower(ua), "stripe") {
			return true
		}
	}
	return false
}

func looksLikeStripeEvent(body []byte) bool {
	trimmedBody := bytes.TrimSpace(body)
	if len(trimmedBody) == 0 || trimmedBody[0] != '{' {
		return false
	}

	var envelope struct {
		ID     string `json:"id"`
		Object string `json:"object"`
		Type   string `json:"type"`
	}
	if err := json.Unmarshal(trimmedBody, &envelope); err != nil {
		return false
	}
	if envelope.Object != "event" {
		return false
	}
	if !strings.HasPrefix(envelope.ID, "evt_") {
		return false
	}
	return strings.Contains(envelope.Type, ".")
}
