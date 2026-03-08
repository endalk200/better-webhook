package resend

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
	hasSvixHeaders := hasRequiredSvixHeaders(ctx.Headers)
	looksLikeResend := looksLikeResendEvent(ctx.Body)
	containsResendPath := strings.Contains(strings.ToLower(ctx.Path), "resend")

	switch {
	case hasSvixHeaders && looksLikeResend:
		return domain.DetectionResult{
			Provider:   domain.ProviderResend,
			Confidence: 0.95,
		}, true
	case containsResendPath && looksLikeResend:
		return domain.DetectionResult{
			Provider:   domain.ProviderResend,
			Confidence: 0.85,
		}, true
	case looksLikeResend:
		return domain.DetectionResult{
			Provider:   domain.ProviderResend,
			Confidence: 0.65,
		}, true
	default:
		return domain.DetectionResult{}, false
	}
}

func hasRequiredSvixHeaders(headerEntries []domain.HeaderEntry) bool {
	return headers.HasHeader(headerEntries, "svix-id") &&
		headers.HasHeader(headerEntries, "svix-timestamp") &&
		headers.HasHeader(headerEntries, "svix-signature")
}

func looksLikeResendEvent(body []byte) bool {
	trimmedBody := bytes.TrimSpace(body)
	if len(trimmedBody) == 0 || trimmedBody[0] != '{' {
		return false
	}

	var envelope struct {
		Type      string          `json:"type"`
		CreatedAt string          `json:"created_at"`
		Data      json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(trimmedBody, &envelope); err != nil {
		return false
	}

	if envelope.CreatedAt == "" || len(bytes.TrimSpace(envelope.Data)) == 0 {
		return false
	}

	category, subtype, ok := strings.Cut(envelope.Type, ".")
	if !ok || category == "" || subtype == "" {
		return false
	}

	switch category {
	case "email":
		return looksLikeResendEmailEvent(subtype, envelope.Data)
	case "domain":
		return looksLikeResendDomainEvent(subtype, envelope.Data)
	case "contact":
		return looksLikeResendContactEvent(subtype, envelope.Data)
	default:
		return false
	}
}

func looksLikeResendEmailEvent(subtype string, raw json.RawMessage) bool {
	if !isKnownResendEmailSubtype(subtype) {
		return false
	}

	var data struct {
		EmailID   string   `json:"email_id"`
		CreatedAt string   `json:"created_at"`
		From      string   `json:"from"`
		To        []string `json:"to"`
		Subject   string   `json:"subject"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return false
	}

	return data.EmailID != "" &&
		data.CreatedAt != "" &&
		data.From != "" &&
		len(data.To) > 0 &&
		data.Subject != ""
}

func looksLikeResendDomainEvent(subtype string, raw json.RawMessage) bool {
	if !isKnownResendDomainSubtype(subtype) {
		return false
	}

	var data struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Status    string `json:"status"`
		CreatedAt string `json:"created_at"`
		Region    string `json:"region"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return false
	}

	return data.ID != "" &&
		data.Name != "" &&
		data.Status != "" &&
		data.CreatedAt != "" &&
		data.Region != ""
}

func looksLikeResendContactEvent(subtype string, raw json.RawMessage) bool {
	if !isKnownResendContactSubtype(subtype) {
		return false
	}

	var data struct {
		ID          string `json:"id"`
		CreatedAt   string `json:"created_at"`
		UpdatedAt   string `json:"updated_at"`
		Email       string `json:"email"`
		Unsubscribe *bool  `json:"unsubscribed"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return false
	}

	return data.ID != "" &&
		data.CreatedAt != "" &&
		data.UpdatedAt != "" &&
		data.Email != "" &&
		data.Unsubscribe != nil
}

func isKnownResendEmailSubtype(subtype string) bool {
	switch subtype {
	case "sent",
		"scheduled",
		"delivered",
		"delivery_delayed",
		"complained",
		"bounced",
		"opened",
		"clicked",
		"received",
		"failed",
		"suppressed":
		return true
	default:
		return false
	}
}

func isKnownResendDomainSubtype(subtype string) bool {
	switch subtype {
	case "created", "updated", "deleted":
		return true
	default:
		return false
	}
}

func isKnownResendContactSubtype(subtype string) bool {
	switch subtype {
	case "created", "updated", "deleted":
		return true
	default:
		return false
	}
}
