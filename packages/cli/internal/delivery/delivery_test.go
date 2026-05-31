package delivery

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

func TestURLWithRequestTargetMergesQueries(t *testing.T) {
	got, err := URLWithRequestTarget("http://127.0.0.1:3000/webhook?token=keep", "/incoming", "debug=1")
	if err != nil {
		t.Fatalf("expected URL to build: %v", err)
	}
	if got != "http://127.0.0.1:3000/webhook/incoming?debug=1&token=keep" {
		t.Fatalf("unexpected URL %q", got)
	}
}

func TestApplyRequestHeadersFiltersHopByHopAndConnectionTokens(t *testing.T) {
	header := http.Header{}
	ApplyRequestHeaders(header, []domain.Header{
		{Name: "Connection", Value: "X-Scoped"},
		{Name: "X-Scoped", Value: "drop"},
		{Name: "Transfer-Encoding", Value: "chunked"},
		{Name: "X-Keep", Value: "preserve"},
	})
	if header.Get("X-Keep") != "preserve" {
		t.Fatalf("expected regular header to be preserved: %#v", header)
	}
	if header.Get("Connection") != "" || header.Get("X-Scoped") != "" || header.Get("Transfer-Encoding") != "" {
		t.Fatalf("expected hop-by-hop headers to be filtered: %#v", header)
	}
}

func TestSendRecordsResponseBodyReadErrors(t *testing.T) {
	client := Client{HTTPClient: &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusAccepted,
			Header:     http.Header{},
			Body:       errorBody{},
		}, nil
	})}}

	result := client.Send(context.Background(), Request{Method: http.MethodPost, URL: "http://127.0.0.1/webhook"})
	if result.StatusCode != http.StatusAccepted {
		t.Fatalf("expected status to be preserved, got %#v", result)
	}
	if !strings.Contains(result.Error, "reading upstream response body") {
		t.Fatalf("expected response read error to be recorded, got %#v", result)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

type errorBody struct{}

func (errorBody) Read(_ []byte) (int, error) {
	return 0, errors.New("stream failed")
}

func (errorBody) Close() error {
	return nil
}

var _ io.ReadCloser = errorBody{}
