package replay

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/capture"
	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
	"github.com/endalk200/better-webhook/packages/cli/internal/provider"
)

func TestLocalVerifiedReplayRegeneratesProviderSignature(t *testing.T) {
	t.Setenv("STRIPE_SECRET", "whsec_test")
	var receivedSignature string
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		receivedSignature = request.Header.Get("Stripe-Signature")
		_, _ = io.ReadAll(request.Body)
		writer.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(upstream.Close)

	body := []byte(`{"id":"evt_1"}`)
	endpoint := domain.EndpointProfile{
		ID:        "stripe-main",
		Mode:      domain.EndpointModeProvider,
		Provider:  "stripe",
		TargetURL: upstream.URL,
		Secret:    &domain.ProviderSecret{Env: "STRIPE_SECRET"},
	}
	item := capture.BuildCapture(
		"cap_1",
		"stripe-main",
		"stripe",
		capture.CapturedRequest(http.MethodPost, "/webhooks/stripe", "", []domain.Header{
			{Name: "Stripe-Signature", Value: "stale"},
			{Name: "Content-Type", Value: "application/json"},
		}, body),
		domain.CaptureAnalysis{},
		nil,
		time.Unix(1, 0),
	)

	result, err := Engine{Providers: provider.NewRegistry()}.Replay(t.Context(), endpoint, item, domain.ReplayModeLocalVerified)
	if err != nil {
		t.Fatalf("expected replay to succeed: %v", err)
	}
	if result.Mode != domain.ReplayModeLocalVerified || result.Delivery.StatusCode != http.StatusNoContent {
		t.Fatalf("unexpected replay result: %#v", result)
	}
	if receivedSignature == "stale" || !strings.HasPrefix(receivedSignature, "t=") {
		t.Fatalf("expected regenerated stripe signature, got %q", receivedSignature)
	}
	parts := strings.Split(receivedSignature, ",v1=")
	if len(parts) != 2 {
		t.Fatalf("unexpected signature shape %q", receivedSignature)
	}
	timestamp := strings.TrimPrefix(parts[0], "t=")
	expected := stripeSignature("whsec_test", timestamp, body)
	if parts[1] != expected {
		t.Fatalf("expected signature %q, got %q", expected, parts[1])
	}
}

func TestLocalVerifiedReplayRejectsExactOnlyCapture(t *testing.T) {
	t.Setenv("STRIPE_SECRET", "whsec_test")
	item := capture.BuildCapture(
		"cap_1",
		"stripe-main",
		"stripe",
		capture.CapturedRequest(http.MethodPost, "/webhooks/stripe", "", []domain.Header{{Name: "Stripe-Signature", Value: "captured"}}, []byte(`{}`)),
		domain.CaptureAnalysis{Capabilities: []string{string(domain.ReplayModeExact)}},
		nil,
		time.Unix(1, 0),
	)

	_, err := Engine{Providers: provider.NewRegistry()}.Replay(t.Context(), domain.EndpointProfile{
		ID:        "stripe-main",
		Mode:      domain.EndpointModeProvider,
		Provider:  "stripe",
		TargetURL: "http://127.0.0.1:1",
		Secret:    &domain.ProviderSecret{Env: "STRIPE_SECRET"},
	}, item, domain.ReplayModeLocalVerified)
	if err == nil || !strings.Contains(err.Error(), "does not allow local-verified replay") {
		t.Fatalf("expected exact-only replay error, got %v", err)
	}
}

func TestDefaultReplayModeFallsBackToExactWhenSecretIsMissing(t *testing.T) {
	mode := defaultMode(provider.NewRegistry(), domain.EndpointProfile{
		ID:        "stripe-main",
		Mode:      domain.EndpointModeProvider,
		Provider:  "stripe",
		TargetURL: "http://127.0.0.1:1",
		Secret:    &domain.ProviderSecret{Env: "MISSING_SECRET"},
	})
	if mode != domain.ReplayModeExact {
		t.Fatalf("expected exact replay without secret, got %q", mode)
	}
}

func TestExactReplayPreservesCapturedSignature(t *testing.T) {
	var receivedSignature string
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		receivedSignature = request.Header.Get("Stripe-Signature")
		writer.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(upstream.Close)

	item := capture.BuildCapture(
		"cap_1",
		"stripe-main",
		"stripe",
		capture.CapturedRequest(http.MethodPost, "/webhooks/stripe", "", []domain.Header{{Name: "Stripe-Signature", Value: "captured"}}, []byte(`{}`)),
		domain.CaptureAnalysis{},
		nil,
		time.Unix(1, 0),
	)

	_, err := Engine{Providers: provider.NewRegistry()}.Replay(t.Context(), domain.EndpointProfile{
		ID:        "stripe-main",
		Mode:      domain.EndpointModeProvider,
		Provider:  "stripe",
		TargetURL: upstream.URL,
	}, item, domain.ReplayModeExact)
	if err != nil {
		t.Fatalf("expected exact replay to succeed: %v", err)
	}
	if receivedSignature != "captured" {
		t.Fatalf("expected exact signature preservation, got %q", receivedSignature)
	}
}

func stripeSignature(secret, timestamp string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}
