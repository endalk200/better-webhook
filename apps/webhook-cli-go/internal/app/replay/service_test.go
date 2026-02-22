package replay

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"testing"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

func TestReplayBuildsRequestFromCapturedURI(t *testing.T) {
	capture := domain.CaptureFile{
		File: "capture.jsonc",
		Capture: domain.CaptureRecord{
			ID:            "deadbeef-0000-0000-0000-000000000000",
			Method:        "POST",
			URL:           "/webhooks/github?foo=bar",
			Path:          "/webhooks/github",
			RawBodyBase64: base64.StdEncoding.EncodeToString([]byte(`{"ok":true}`)),
			Headers: []domain.HeaderEntry{
				{Key: "Host", Value: "localhost:3001"},
				{Key: "X-GitHub-Event", Value: "push"},
				{Key: "X-Hub-Signature-256", Value: "sha256=abc"},
				{Key: "Content-Length", Value: "11"},
				{Key: "Content-Type", Value: "application/json"},
			},
		},
	}
	repo := &repoStub{capture: capture}
	dispatcher := &dispatcherStub{
		result: DispatchResult{
			StatusCode: 200,
			StatusText: "OK",
			Duration:   12 * time.Millisecond,
		},
	}
	service := NewService(repo, dispatcher)

	result, err := service.Replay(context.Background(), ReplayRequest{
		Selector: "deadbeef",
		BaseURL:  "http://localhost:3000",
		Timeout:  30 * time.Second,
	})
	if err != nil {
		t.Fatalf("replay capture: %v", err)
	}

	if dispatcher.request.URL != "http://localhost:3000/webhooks/github?foo=bar" {
		t.Fatalf("target URL mismatch: got %q", dispatcher.request.URL)
	}
	if dispatcher.request.Method != "POST" {
		t.Fatalf("method mismatch: got %q", dispatcher.request.Method)
	}
	if string(dispatcher.request.Body) != `{"ok":true}` {
		t.Fatalf("body mismatch: got %q", string(dispatcher.request.Body))
	}
	if containsHeader(dispatcher.request.Headers, "Host") {
		t.Fatalf("expected host header to be skipped")
	}
	if containsHeader(dispatcher.request.Headers, "Content-Length") {
		t.Fatalf("expected content-length header to be skipped")
	}
	if !containsHeader(dispatcher.request.Headers, "X-GitHub-Event") {
		t.Fatalf("expected GitHub event header to be preserved")
	}
	if !containsHeader(dispatcher.request.Headers, "X-Hub-Signature-256") {
		t.Fatalf("expected GitHub signature header to be preserved")
	}
	if result.Response.StatusCode != 200 {
		t.Fatalf("status mismatch: got %d", result.Response.StatusCode)
	}
}

func TestReplayAppliesMethodAndHeaderOverrides(t *testing.T) {
	capture := domain.CaptureFile{
		Capture: domain.CaptureRecord{
			ID:            "cab005e5-0000-0000-0000-000000000000",
			Method:        "POST",
			URL:           "/webhooks/test",
			RawBodyBase64: base64.StdEncoding.EncodeToString([]byte(`{"ok":true}`)),
			Headers: []domain.HeaderEntry{
				{Key: "Content-Type", Value: "application/json"},
				{Key: "X-Original", Value: "true"},
			},
		},
	}
	repo := &repoStub{capture: capture}
	dispatcher := &dispatcherStub{result: DispatchResult{StatusCode: 202, StatusText: "Accepted"}}
	service := NewService(repo, dispatcher)

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector:       "cab005e5",
		TargetURL:      "https://example.com/hook",
		MethodOverride: "patch",
		HeaderOverrides: []domain.HeaderEntry{
			{Key: "content-type", Value: "application/custom+json"},
			{Key: "X-New", Value: "added"},
		},
		Timeout: 20 * time.Second,
	})
	if err != nil {
		t.Fatalf("replay capture: %v", err)
	}

	if dispatcher.request.Method != "PATCH" {
		t.Fatalf("method mismatch: got %q", dispatcher.request.Method)
	}
	if headerValue(dispatcher.request.Headers, "content-type") != "application/custom+json" {
		t.Fatalf("expected content-type override to be applied")
	}
	if headerValue(dispatcher.request.Headers, "x-new") != "added" {
		t.Fatalf("expected x-new header to be appended")
	}
}

func TestReplaySkipsHopByHopHeaderOverrides(t *testing.T) {
	capture := domain.CaptureFile{
		Capture: domain.CaptureRecord{
			ID:            "cab005e5-0000-0000-0000-000000000001",
			Method:        "POST",
			URL:           "/webhooks/test",
			RawBodyBase64: base64.StdEncoding.EncodeToString([]byte(`{"ok":true}`)),
			Headers: []domain.HeaderEntry{
				{Key: "Content-Type", Value: "application/json"},
			},
		},
	}
	repo := &repoStub{capture: capture}
	dispatcher := &dispatcherStub{result: DispatchResult{StatusCode: 202, StatusText: "Accepted"}}
	service := NewService(repo, dispatcher)

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector:  "cab005e5",
		TargetURL: "https://example.com/hook",
		HeaderOverrides: []domain.HeaderEntry{
			{Key: "Host", Value: "evil.example"},
			{Key: "Content-Length", Value: "999"},
			{Key: "Connection", Value: "keep-alive"},
			{Key: "X-New", Value: "added"},
		},
		Timeout: 20 * time.Second,
	})
	if err != nil {
		t.Fatalf("replay capture: %v", err)
	}

	if containsHeader(dispatcher.request.Headers, "Host") {
		t.Fatalf("expected host override to be skipped")
	}
	if containsHeader(dispatcher.request.Headers, "Content-Length") {
		t.Fatalf("expected content-length override to be skipped")
	}
	if containsHeader(dispatcher.request.Headers, "Connection") {
		t.Fatalf("expected connection override to be skipped")
	}
	if headerValue(dispatcher.request.Headers, "x-new") != "added" {
		t.Fatalf("expected non-hop-by-hop override to be applied")
	}
}

func TestReplayReturnsInvalidBodyError(t *testing.T) {
	repo := &repoStub{
		capture: domain.CaptureFile{
			Capture: domain.CaptureRecord{
				ID:            "feedbeef-0000-0000-0000-000000000000",
				Method:        "POST",
				URL:           "/hook",
				RawBodyBase64: "not-base64",
			},
		},
	}
	service := NewService(repo, &dispatcherStub{})

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector: "feedbeef",
		BaseURL:  "http://localhost:3000",
		Timeout:  5 * time.Second,
	})
	if !errors.Is(err, ErrInvalidBody) {
		t.Fatalf("expected invalid body error, got %v", err)
	}
}

func TestReplayReturnsInvalidMethodError(t *testing.T) {
	repo := &repoStub{
		capture: domain.CaptureFile{
			Capture: domain.CaptureRecord{
				ID:            "aa112233-0000-0000-0000-000000000000",
				Method:        "POST",
				URL:           "/hook",
				RawBodyBase64: base64.StdEncoding.EncodeToString([]byte("{}")),
			},
		},
	}
	service := NewService(repo, &dispatcherStub{})

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector:       "aa112233",
		BaseURL:        "http://localhost:3000",
		MethodOverride: "PO ST",
		Timeout:        5 * time.Second,
	})
	if !errors.Is(err, ErrInvalidMethod) {
		t.Fatalf("expected invalid method error, got %v", err)
	}
}

func TestIsValidHTTPMethodRejectsEmpty(t *testing.T) {
	if isValidHTTPMethod("") {
		t.Fatalf("expected empty method to be invalid")
	}
}

func TestReplayReturnsInvalidBaseURLError(t *testing.T) {
	repo := &repoStub{
		capture: domain.CaptureFile{
			Capture: domain.CaptureRecord{
				ID:            "12345678-0000-0000-0000-000000000000",
				Method:        "POST",
				URL:           "/hook",
				RawBodyBase64: base64.StdEncoding.EncodeToString([]byte("{}")),
			},
		},
	}
	service := NewService(repo, &dispatcherStub{})

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector: "12345678",
		BaseURL:  "localhost:3000",
		Timeout:  5 * time.Second,
	})
	if !errors.Is(err, ErrInvalidBaseURL) {
		t.Fatalf("expected invalid base URL error, got %v", err)
	}
}

func TestReplayReturnsInvalidBaseURLErrorForUnsupportedScheme(t *testing.T) {
	repo := &repoStub{
		capture: domain.CaptureFile{
			Capture: domain.CaptureRecord{
				ID:            "12345678-0000-0000-0000-000000000000",
				Method:        "POST",
				URL:           "/hook",
				RawBodyBase64: base64.StdEncoding.EncodeToString([]byte("{}")),
			},
		},
	}
	service := NewService(repo, &dispatcherStub{})

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector: "12345678",
		BaseURL:  "ftp://localhost:3000",
		Timeout:  5 * time.Second,
	})
	if !errors.Is(err, ErrInvalidBaseURL) {
		t.Fatalf("expected invalid base URL error, got %v", err)
	}
}

func TestReplayReturnsInvalidTargetURLError(t *testing.T) {
	repo := &repoStub{
		capture: domain.CaptureFile{
			Capture: domain.CaptureRecord{
				ID:            "12345678-0000-0000-0000-000000000000",
				Method:        "POST",
				URL:           "/hook",
				RawBodyBase64: base64.StdEncoding.EncodeToString([]byte("{}")),
			},
		},
	}
	service := NewService(repo, &dispatcherStub{})

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector:  "12345678",
		TargetURL: "not-a-url",
		Timeout:   5 * time.Second,
	})
	if !errors.Is(err, ErrInvalidTargetURL) {
		t.Fatalf("expected invalid target URL error, got %v", err)
	}
}

func TestReplayReturnsInvalidTargetURLErrorForUnsupportedScheme(t *testing.T) {
	repo := &repoStub{
		capture: domain.CaptureFile{
			Capture: domain.CaptureRecord{
				ID:            "12345678-0000-0000-0000-000000000000",
				Method:        "POST",
				URL:           "/hook",
				RawBodyBase64: base64.StdEncoding.EncodeToString([]byte("{}")),
			},
		},
	}
	service := NewService(repo, &dispatcherStub{})

	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector:  "12345678",
		TargetURL: "file://localhost/tmp/payload",
		Timeout:   5 * time.Second,
	})
	if !errors.Is(err, ErrInvalidTargetURL) {
		t.Fatalf("expected invalid target URL error, got %v", err)
	}
}

func TestReplayPropagatesContextCancellation(t *testing.T) {
	repo := &repoStub{
		err: context.Canceled,
	}
	service := NewService(repo, &dispatcherStub{})
	_, err := service.Replay(context.Background(), ReplayRequest{
		Selector: "deadbeef",
		BaseURL:  "http://localhost:3000",
		Timeout:  5 * time.Second,
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled error, got %v", err)
	}
}

func TestNewServicePanicsOnNilDependencies(t *testing.T) {
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatalf("expected panic when repo is nil")
		}
	}()
	_ = NewService(nil, &dispatcherStub{})
}

func TestNewServicePanicsOnNilDispatcher(t *testing.T) {
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatalf("expected panic when dispatcher is nil")
		}
	}()
	_ = NewService(&repoStub{}, nil)
}

type repoStub struct {
	capture domain.CaptureFile
	err     error
}

func (s *repoStub) ResolveByIDOrPrefix(context.Context, string) (domain.CaptureFile, error) {
	if s.err != nil {
		return domain.CaptureFile{}, s.err
	}
	return s.capture, nil
}

type dispatcherStub struct {
	request DispatchRequest
	result  DispatchResult
	err     error
}

func (s *dispatcherStub) Dispatch(_ context.Context, request DispatchRequest) (DispatchResult, error) {
	s.request = request
	if s.err != nil {
		return DispatchResult{}, s.err
	}
	return s.result, nil
}

func containsHeader(headers []domain.HeaderEntry, key string) bool {
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			return true
		}
	}
	return false
}

func headerValue(headers []domain.HeaderEntry, key string) string {
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			return header.Value
		}
	}
	return ""
}
