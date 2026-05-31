package provider

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

type Registry struct {
	providers map[string]Capabilities
}

type Capabilities struct {
	Name                     string   `json:"name"`
	TemplateSigning          bool     `json:"templateSigning"`
	LocalVerifiedReplay      bool     `json:"localVerifiedReplay"`
	SignedTimestamp          bool     `json:"signedTimestamp"`
	ReplayModes              []string `json:"replayModes"`
	VerificationCapabilities []string `json:"verificationCapabilities"`
}

type SigningContext struct {
	Endpoint domain.EndpointProfile
	Body     []byte
	Headers  []domain.Header
	Now      time.Time
}

func NewRegistry() Registry {
	return Registry{
		providers: map[string]Capabilities{
			"stripe": {
				Name:                "stripe",
				TemplateSigning:     true,
				LocalVerifiedReplay: true,
				SignedTimestamp:     true,
				ReplayModes:         []string{string(domain.ReplayModeExact), string(domain.ReplayModeLocalVerified)},
				VerificationCapabilities: []string{
					"raw-body-hmac-sha256",
					"signed-timestamp",
					"signature-header-regeneration",
				},
			},
			"github": {
				Name:                "github",
				TemplateSigning:     true,
				LocalVerifiedReplay: true,
				SignedTimestamp:     false,
				ReplayModes:         []string{string(domain.ReplayModeExact), string(domain.ReplayModeLocalVerified)},
				VerificationCapabilities: []string{
					"raw-body-hmac-sha256",
					"delivery-id",
					"signature-header-regeneration",
				},
			},
		},
	}
}

func (r Registry) Capabilities(providerName string) (Capabilities, bool) {
	capabilities, ok := r.providers[strings.ToLower(providerName)]
	return capabilities, ok
}

func (r Registry) SupportsTemplate(providerName string) bool {
	capabilities, ok := r.Capabilities(providerName)
	return ok && capabilities.TemplateSigning
}

func (r Registry) Sign(ctx SigningContext) ([]domain.Header, error) {
	providerName := strings.ToLower(ctx.Endpoint.Provider)
	secret, err := SecretValue(ctx.Endpoint)
	if err != nil {
		return nil, err
	}
	headers := removeProviderSignatureHeaders(providerName, ctx.Headers)
	if ctx.Now.IsZero() {
		ctx.Now = time.Now()
	}

	switch providerName {
	case "stripe":
		timestamp := ctx.Now.Unix()
		signature := stripeSignature(secret, timestamp, ctx.Body)
		headers = setHeader(headers, "Stripe-Signature", fmt.Sprintf("t=%d,v1=%s", timestamp, signature))
	case "github":
		signature := githubSignature(secret, ctx.Body)
		headers = setHeader(headers, "X-Hub-Signature-256", "sha256="+signature)
		if getHeader(headers, "X-GitHub-Delivery") == "" {
			headers = setHeader(headers, "X-GitHub-Delivery", randomHex(16))
		}
	default:
		return nil, fmt.Errorf("provider %q does not support verification-compatible signing", providerName)
	}

	return headers, nil
}

func SecretValue(endpoint domain.EndpointProfile) (string, error) {
	if endpoint.Secret.Env == "" {
		return "", fmt.Errorf("endpoint %q has no configured secret env reference", endpoint.ID)
	}
	value := os.Getenv(endpoint.Secret.Env)
	if value == "" {
		return "", fmt.Errorf("environment variable %s is required for endpoint %q", endpoint.Secret.Env, endpoint.ID)
	}
	return value, nil
}

func Analyze(endpoint domain.EndpointProfile, headers []domain.Header) domain.CaptureAnalysis {
	expectedProvider := strings.ToLower(endpoint.Provider)
	detectedProvider, detected := detectProvider(headers)
	analysis := domain.CaptureAnalysis{
		ProviderDetected: detected,
		DetectedProvider: detectedProvider,
	}

	switch {
	case endpoint.Mode == domain.EndpointModeGeneric:
		analysis.Capabilities = []string{string(domain.ReplayModeExact)}
	case detected && detectedProvider != expectedProvider:
		analysis.Capabilities = []string{string(domain.ReplayModeExact)}
		analysis.Warnings = append(analysis.Warnings, fmt.Sprintf("route belongs to provider %q but headers look like %q", expectedProvider, detectedProvider))
	case expectedProvider != "":
		if capabilities, ok := NewRegistry().Capabilities(expectedProvider); ok {
			analysis.Capabilities = capabilities.ReplayModes
		} else {
			analysis.Capabilities = []string{string(domain.ReplayModeExact)}
		}
	default:
		analysis.Capabilities = []string{string(domain.ReplayModeExact)}
	}

	return analysis
}

func detectProvider(headers []domain.Header) (string, bool) {
	switch {
	case getHeader(headers, "Stripe-Signature") != "":
		return "stripe", true
	case getHeader(headers, "X-Hub-Signature-256") != "" || getHeader(headers, "X-GitHub-Event") != "":
		return "github", true
	default:
		return "", false
	}
}

func stripeSignature(secret string, timestamp int64, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = fmt.Fprintf(mac, "%d.", timestamp)
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func githubSignature(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func removeProviderSignatureHeaders(providerName string, headers []domain.Header) []domain.Header {
	var signatureHeaders []string
	switch providerName {
	case "stripe":
		signatureHeaders = []string{"stripe-signature"}
	case "github":
		signatureHeaders = []string{"x-hub-signature-256"}
	default:
		return headers
	}

	filtered := make([]domain.Header, 0, len(headers))
	for _, header := range headers {
		if !containsFold(signatureHeaders, header.Name) {
			filtered = append(filtered, header)
		}
	}
	return filtered
}

func setHeader(headers []domain.Header, name, value string) []domain.Header {
	filtered := make([]domain.Header, 0, len(headers)+1)
	for _, header := range headers {
		if !strings.EqualFold(header.Name, name) {
			filtered = append(filtered, header)
		}
	}
	return append(filtered, domain.Header{Name: name, Value: value})
}

func getHeader(headers []domain.Header, name string) string {
	for _, header := range headers {
		if strings.EqualFold(header.Name, name) {
			return header.Value
		}
	}
	return ""
}

func containsFold(values []string, needle string) bool {
	for _, value := range values {
		if strings.EqualFold(value, needle) {
			return true
		}
	}
	return false
}

func randomHex(bytes int) string {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("delivery-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}
