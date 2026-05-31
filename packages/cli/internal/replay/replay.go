package replay

import (
	"context"
	"fmt"

	"github.com/endalk200/better-webhook/packages/cli/internal/capture"
	"github.com/endalk200/better-webhook/packages/cli/internal/delivery"
	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
	"github.com/endalk200/better-webhook/packages/cli/internal/provider"
)

type Engine struct {
	Delivery  delivery.Client
	Providers provider.Registry
}

type Result struct {
	CaptureID string                `json:"captureId"`
	Endpoint  string                `json:"endpointId"`
	Mode      domain.ReplayMode     `json:"mode"`
	Request   RequestSummary        `json:"request"`
	Delivery  domain.DeliveryResult `json:"delivery"`
}

type RequestSummary struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Query  string `json:"query,omitempty"`
}

func (e Engine) Replay(ctx context.Context, endpoint domain.EndpointProfile, captured domain.Capture, mode domain.ReplayMode) (Result, error) {
	if mode == "" {
		mode = defaultMode(e.Providers, endpoint)
	}
	if captured.EndpointID != endpoint.ID {
		return Result{}, fmt.Errorf("capture %q belongs to endpoint %q and cannot be replayed to endpoint %q", captured.ID, captured.EndpointID, endpoint.ID)
	}
	body, err := capture.BodyBytes(captured.Request)
	if err != nil {
		return Result{}, err
	}
	headers := captured.Request.Headers
	switch mode {
	case domain.ReplayModeExact:
	case domain.ReplayModeLocalVerified:
		if endpoint.Mode != domain.EndpointModeProvider {
			return Result{}, fmt.Errorf("local-verified replay requires a provider-aware endpoint")
		}
		signed, err := e.Providers.Sign(provider.SigningContext{
			Endpoint: endpoint,
			Body:     body,
			Headers:  headers,
		})
		if err != nil {
			return Result{}, err
		}
		headers = signed
	default:
		return Result{}, fmt.Errorf("unsupported replay mode %q", mode)
	}

	targetURL, err := delivery.URLWithRequestTarget(endpoint.TargetURL, "", captured.Request.RawQuery)
	if err != nil {
		return Result{}, err
	}
	result := e.Delivery.Send(ctx, delivery.Request{
		Method:  captured.Request.Method,
		URL:     targetURL,
		Headers: headers,
		Body:    body,
	})
	return Result{
		CaptureID: captured.ID,
		Endpoint:  endpoint.ID,
		Mode:      mode,
		Request: RequestSummary{
			Method: captured.Request.Method,
			Path:   captured.Request.Path,
			Query:  captured.Request.RawQuery,
		},
		Delivery: result,
	}, nil
}

func defaultMode(registry provider.Registry, endpoint domain.EndpointProfile) domain.ReplayMode {
	if endpoint.Mode == domain.EndpointModeProvider {
		if capabilities, ok := registry.Capabilities(endpoint.Provider); ok && capabilities.LocalVerifiedReplay {
			return domain.ReplayModeLocalVerified
		}
	}
	return domain.ReplayModeExact
}
