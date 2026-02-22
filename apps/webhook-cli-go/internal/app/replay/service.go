package replay

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	platformhttprequest "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/httprequest"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/httpurl"
)

type Service struct {
	repo       CaptureRepository
	dispatcher Dispatcher
}

func NewService(repo CaptureRepository, dispatcher Dispatcher) *Service {
	if repo == nil {
		panic("repo cannot be nil")
	}
	if dispatcher == nil {
		panic("dispatcher cannot be nil")
	}
	return &Service{
		repo:       repo,
		dispatcher: dispatcher,
	}
}

func (s *Service) Replay(ctx context.Context, request ReplayRequest) (ReplayResult, error) {
	captureFile, err := s.repo.ResolveByIDOrPrefix(ctx, request.Selector)
	if err != nil {
		return ReplayResult{}, err
	}

	targetURL, err := resolveTargetURL(request, captureFile)
	if err != nil {
		return ReplayResult{}, err
	}
	method, err := resolveMethod(request.MethodOverride, captureFile.Capture.Method)
	if err != nil {
		return ReplayResult{}, err
	}
	body, err := decodeBody(captureFile.Capture.RawBodyBase64)
	if err != nil {
		return ReplayResult{}, err
	}
	headers := buildReplayHeaders(captureFile.Capture.Headers, request.HeaderOverrides)

	dispatched, err := s.dispatcher.Dispatch(ctx, DispatchRequest{
		Method:  method,
		URL:     targetURL,
		Headers: headers,
		Body:    body,
		Timeout: request.Timeout,
	})
	if err != nil {
		return ReplayResult{}, err
	}

	return ReplayResult{
		Capture:     captureFile,
		TargetURL:   targetURL,
		Method:      method,
		SentHeaders: headers,
		Response:    ReplayResponse(dispatched),
	}, nil
}

func resolveTargetURL(request ReplayRequest, captureFile domain.CaptureFile) (string, error) {
	trimmedTarget := strings.TrimSpace(request.TargetURL)
	if trimmedTarget != "" {
		if err := httpurl.ValidateAbsolute(trimmedTarget); err != nil {
			return "", fmt.Errorf("%w: %v", ErrInvalidTargetURL, err)
		}
		return trimmedTarget, nil
	}

	baseURL := strings.TrimSpace(request.BaseURL)
	if err := httpurl.ValidateAbsolute(baseURL); err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidBaseURL, err)
	}

	requestURI := strings.TrimSpace(captureFile.Capture.URL)
	if requestURI == "" {
		requestURI = strings.TrimSpace(captureFile.Capture.Path)
	}
	if requestURI == "" {
		requestURI = "/"
	}

	baseParsed, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidBaseURL, err)
	}
	ref, err := url.Parse(requestURI)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidTargetURL, err)
	}
	return baseParsed.ResolveReference(ref).String(), nil
}

func resolveMethod(methodOverride string, fallback string) (string, error) {
	method := strings.ToUpper(strings.TrimSpace(methodOverride))
	if method == "" {
		method = strings.ToUpper(strings.TrimSpace(fallback))
	}
	if method == "" {
		method = http.MethodPost
	}
	if !platformhttprequest.IsValidHTTPMethod(method) {
		return "", ErrInvalidMethod
	}
	return method, nil
}

func decodeBody(encoded string) ([]byte, error) {
	trimmed := strings.TrimSpace(encoded)
	if trimmed == "" {
		return []byte{}, nil
	}
	body, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidBody, err)
	}
	return body, nil
}

func buildReplayHeaders(captured []domain.HeaderEntry, overrides []domain.HeaderEntry) []domain.HeaderEntry {
	filtered := make([]domain.HeaderEntry, 0, len(captured))
	for _, header := range captured {
		if strings.TrimSpace(header.Key) == "" {
			continue
		}
		if platformhttprequest.ShouldSkipHopByHopHeader(header.Key) {
			continue
		}
		filtered = append(filtered, header)
	}
	return toCaptureHeaders(
		platformhttprequest.ApplyHeaderOverrides(
			toRequestHeaders(filtered),
			toRequestHeaders(overrides),
		),
	)
}

func toRequestHeaders(headers []domain.HeaderEntry) []platformhttprequest.HeaderEntry {
	converted := make([]platformhttprequest.HeaderEntry, 0, len(headers))
	for _, header := range headers {
		converted = append(converted, platformhttprequest.HeaderEntry{
			Key:   header.Key,
			Value: header.Value,
		})
	}
	return converted
}

func toCaptureHeaders(headers []platformhttprequest.HeaderEntry) []domain.HeaderEntry {
	converted := make([]domain.HeaderEntry, 0, len(headers))
	for _, header := range headers {
		converted = append(converted, domain.HeaderEntry{
			Key:   header.Key,
			Value: header.Value,
		})
	}
	return converted
}

func isValidHTTPMethod(method string) bool {
	return platformhttprequest.IsValidHTTPMethod(method)
}
