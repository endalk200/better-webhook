package httptemplaterun

import (
	"context"
	"errors"
	"testing"
	"time"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/replay"
	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/templates"
	capturedomain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	templatedomain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

type replayDispatcherStub struct {
	lastRequest appreplay.DispatchRequest
	result      appreplay.DispatchResult
	err         error
}

func (s *replayDispatcherStub) Dispatch(_ context.Context, request appreplay.DispatchRequest) (appreplay.DispatchResult, error) {
	s.lastRequest = request
	if s.err != nil {
		return appreplay.DispatchResult{}, s.err
	}
	return s.result, nil
}

func TestNewDispatcherPanicsOnNilReplayDispatcher(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatalf("expected panic when replay dispatcher is nil")
		}
	}()
	_ = NewDispatcher(nil)
}

func TestDispatcherDispatchForwardsRequestAndMapsResponse(t *testing.T) {
	stub := &replayDispatcherStub{
		result: appreplay.DispatchResult{
			StatusCode: 201,
			StatusText: "Created",
			Headers: []capturedomain.HeaderEntry{
				{Key: "Content-Type", Value: "application/json"},
			},
			Body:          []byte(`{"ok":true}`),
			BodyTruncated: false,
			Duration:      42 * time.Millisecond,
		},
	}
	dispatcher := NewDispatcher(stub)

	result, err := dispatcher.Dispatch(context.Background(), apptemplates.DispatchRequest{
		Method: "POST",
		URL:    "http://localhost:3000/webhooks/github",
		Headers: []templatedomain.HeaderEntry{
			{Key: "X-Test", Value: "one"},
		},
		Body:    []byte(`{"event":"push"}`),
		Timeout: 5 * time.Second,
	})
	if err != nil {
		t.Fatalf("dispatch request: %v", err)
	}

	if stub.lastRequest.Method != "POST" {
		t.Fatalf("method mismatch: got %q", stub.lastRequest.Method)
	}
	if stub.lastRequest.URL != "http://localhost:3000/webhooks/github" {
		t.Fatalf("url mismatch: got %q", stub.lastRequest.URL)
	}
	if stub.lastRequest.Timeout != 5*time.Second {
		t.Fatalf("timeout mismatch: got %s", stub.lastRequest.Timeout)
	}
	if len(stub.lastRequest.Headers) != 1 || stub.lastRequest.Headers[0].Key != "X-Test" || stub.lastRequest.Headers[0].Value != "one" {
		t.Fatalf("request headers mismatch: got %#v", stub.lastRequest.Headers)
	}
	if string(stub.lastRequest.Body) != `{"event":"push"}` {
		t.Fatalf("body mismatch: got %q", string(stub.lastRequest.Body))
	}

	if result.StatusCode != 201 || result.StatusText != "Created" {
		t.Fatalf("status mismatch: got %d %q", result.StatusCode, result.StatusText)
	}
	if len(result.Headers) != 1 || result.Headers[0].Key != "Content-Type" || result.Headers[0].Value != "application/json" {
		t.Fatalf("response headers mismatch: got %#v", result.Headers)
	}
	if string(result.Body) != `{"ok":true}` {
		t.Fatalf("response body mismatch: got %q", string(result.Body))
	}
	if result.Duration != 42*time.Millisecond {
		t.Fatalf("duration mismatch: got %s", result.Duration)
	}
}

func TestDispatcherDispatchPanicsOnNilReplayDispatcher(t *testing.T) {
	dispatcher := &Dispatcher{}
	defer func() {
		if recover() == nil {
			t.Fatalf("expected panic when replay dispatcher is nil")
		}
	}()
	_, _ = dispatcher.Dispatch(context.Background(), apptemplates.DispatchRequest{
		Method:  "POST",
		URL:     "http://localhost:3000/webhooks/github",
		Timeout: time.Second,
	})
}

func TestDispatcherDispatchPropagatesError(t *testing.T) {
	expectedErr := errors.New("dispatch failed")
	stub := &replayDispatcherStub{err: expectedErr}
	dispatcher := NewDispatcher(stub)

	_, err := dispatcher.Dispatch(context.Background(), apptemplates.DispatchRequest{
		Method:  "POST",
		URL:     "http://localhost:3000/webhooks/github",
		Timeout: time.Second,
	})
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected propagated dispatch error, got %v", err)
	}
}

func TestDispatcherDispatchHandlesNilHeaders(t *testing.T) {
	stub := &replayDispatcherStub{
		result: appreplay.DispatchResult{
			StatusCode: 200,
			StatusText: "OK",
		},
	}
	dispatcher := NewDispatcher(stub)

	_, err := dispatcher.Dispatch(context.Background(), apptemplates.DispatchRequest{
		Method:  "POST",
		URL:     "http://localhost:3000/webhooks/github",
		Headers: nil,
		Timeout: time.Second,
	})
	if err != nil {
		t.Fatalf("expected nil headers to be supported, got %v", err)
	}
	if len(stub.lastRequest.Headers) != 0 {
		t.Fatalf("expected zero forwarded headers, got %d", len(stub.lastRequest.Headers))
	}
}
