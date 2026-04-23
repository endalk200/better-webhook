package httpreplay

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/replay"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

func TestClientDispatchSendsMethodHeadersAndBody(t *testing.T) {
	var receivedMethod string
	var receivedBody string
	var receivedHeader string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		bodyBytes, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}
		receivedMethod = req.Method
		receivedBody = string(bodyBytes)
		receivedHeader = req.Header.Get("X-Test")
		w.Header().Set("X-Response", "ok")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"status":"accepted"}`))
	}))
	defer server.Close()

	client := NewClient(server.Client())
	result, err := client.Dispatch(context.Background(), appreplay.DispatchRequest{
		Method: "PATCH",
		URL:    server.URL + "/hook",
		Headers: []domain.HeaderEntry{
			{Key: "X-Test", Value: "present"},
		},
		Body:    []byte(`{"ok":true}`),
		Timeout: 5 * time.Second,
	})
	if err != nil {
		t.Fatalf("dispatch replay request: %v", err)
	}
	if receivedMethod != "PATCH" {
		t.Fatalf("expected PATCH method, got %q", receivedMethod)
	}
	if receivedBody != `{"ok":true}` {
		t.Fatalf("request body mismatch: got %q", receivedBody)
	}
	if receivedHeader != "present" {
		t.Fatalf("header mismatch: got %q", receivedHeader)
	}
	if result.StatusCode != http.StatusAccepted {
		t.Fatalf("status mismatch: got %d", result.StatusCode)
	}
	if result.StatusText != http.StatusText(http.StatusAccepted) {
		t.Fatalf("status text mismatch: got %q", result.StatusText)
	}
	if string(result.Body) != `{"status":"accepted"}` {
		t.Fatalf("response body mismatch: got %q", string(result.Body))
	}
	if result.Duration <= 0 {
		t.Fatalf("expected positive duration")
	}
}

func TestClientDispatchTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		time.Sleep(150 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client := NewClient(server.Client())
	_, err := client.Dispatch(context.Background(), appreplay.DispatchRequest{
		Method:  "POST",
		URL:     server.URL,
		Timeout: 20 * time.Millisecond,
	})
	if err == nil {
		t.Fatalf("expected timeout error")
	}
	if !errors.Is(err, context.DeadlineExceeded) && !strings.Contains(strings.ToLower(err.Error()), "context deadline exceeded") {
		t.Fatalf("expected deadline exceeded error, got %v", err)
	}
}

func TestClientDispatchRejectsNonPositiveTimeout(t *testing.T) {
	client := NewClient(&http.Client{})
	_, err := client.Dispatch(context.Background(), appreplay.DispatchRequest{
		Method:  "POST",
		URL:     "http://localhost",
		Timeout: 0,
	})
	if err == nil {
		t.Fatalf("expected timeout validation error")
	}
	if !strings.Contains(err.Error(), "timeout must be greater than 0") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestClientDispatchTruncatesLargeResponseBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(strings.Repeat("a", int(defaultMaxResponseBodyBytes+20))))
	}))
	defer server.Close()

	client := NewClient(server.Client())
	result, err := client.Dispatch(context.Background(), appreplay.DispatchRequest{
		Method:  "POST",
		URL:     server.URL,
		Timeout: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("dispatch replay request: %v", err)
	}
	if !result.BodyTruncated {
		t.Fatalf("expected body to be truncated")
	}
	if len(result.Body) != int(defaultMaxResponseBodyBytes) {
		t.Fatalf("truncated body length mismatch: got %d", len(result.Body))
	}
}
