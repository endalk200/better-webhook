package httptemplates

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestFetchIndexAndTemplate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.URL.Path {
		case "/templates/templates.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
  "version":"1.0.0",
  "templates":[
    {
      "id":"github-push",
      "name":"GitHub Push",
      "provider":"github",
      "event":"push",
      "file":"github/github-push.jsonc"
    }
  ]
}`))
		case "/templates/github/github-push.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"headers":[{"key":"X-GitHub-Event","value":"push"}]}`))
		default:
			http.NotFound(w, req)
		}
	}))
	defer server.Close()

	client, err := NewClient(ClientOptions{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	index, err := client.FetchIndex(context.Background())
	if err != nil {
		t.Fatalf("fetch index: %v", err)
	}
	if len(index.Templates) != 1 {
		t.Fatalf("expected one template in index, got %d", len(index.Templates))
	}
	template, err := client.FetchTemplate(context.Background(), index.Templates[0].File)
	if err != nil {
		t.Fatalf("fetch template: %v", err)
	}
	if template.Method != "POST" {
		t.Fatalf("expected default method POST, got %q", template.Method)
	}
	if len(template.Headers) != 1 {
		t.Fatalf("expected one header, got %d", len(template.Headers))
	}
}

func TestFetchIndexAndTemplateSupportsJSONC(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.URL.Path {
		case "/templates/templates.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
  // jsonc index
  "version":"1.0.0",
  "templates":[
    {
      "id":"github-push",
      "name":"GitHub Push",
      "provider":"github",
      "event":"push",
      "file":"github/github-push.jsonc",
    },
  ],
}`))
		case "/templates/github/github-push.jsonc":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
  "method": "POST",
  "headers": [
    {"key":"X-GitHub-Event","value":"push"},
  ],
}`))
		default:
			http.NotFound(w, req)
		}
	}))
	defer server.Close()

	client, err := NewClient(ClientOptions{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	index, err := client.FetchIndex(context.Background())
	if err != nil {
		t.Fatalf("fetch index: %v", err)
	}
	if len(index.Templates) != 1 {
		t.Fatalf("expected one template in index, got %d", len(index.Templates))
	}
	template, err := client.FetchTemplate(context.Background(), index.Templates[0].File)
	if err != nil {
		t.Fatalf("fetch template: %v", err)
	}
	if template.Method != "POST" {
		t.Fatalf("expected default method POST, got %q", template.Method)
	}
	if len(template.Headers) != 1 {
		t.Fatalf("expected one header, got %d", len(template.Headers))
	}
}

func TestFetchIndexReturnsErrorOnNon200(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client, err := NewClient(ClientOptions{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	if _, err := client.FetchIndex(context.Background()); err == nil {
		t.Fatalf("expected non-200 fetch index error")
	}
}

func TestFetchTemplateRejectsUnsafePath(t *testing.T) {
	client, err := NewClient(ClientOptions{})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	if _, err := client.FetchTemplate(context.Background(), "../escape.jsonc"); err == nil {
		t.Fatalf("expected invalid template file error")
	}
	if _, err := client.FetchTemplate(context.Background(), "github/push.json?mode=raw"); err == nil {
		t.Fatalf("expected invalid template file characters error")
	}
	if _, err := client.FetchTemplate(context.Background(), "github/%2e%2e/push.jsonc"); err == nil {
		t.Fatalf("expected percent-encoded path traversal to be rejected")
	}
	if _, err := client.FetchTemplate(context.Background(), "github/\ninvalid.jsonc"); err == nil {
		t.Fatalf("expected control character path to be rejected")
	}
	if _, err := client.FetchTemplate(context.Background(), "github//push.jsonc"); err == nil {
		t.Fatalf("expected duplicate path separators to be rejected")
	}
}

func TestFetchTemplateRejectsJSONExtension(t *testing.T) {
	client, err := NewClient(ClientOptions{})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	if _, err := client.FetchTemplate(context.Background(), "github/github-push.json"); err == nil {
		t.Fatalf("expected json extension to be rejected")
	}
}

func TestFetchIndexRejectsEmptyTemplateList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/templates/templates.jsonc" {
			http.NotFound(w, req)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"version":"1.0.0","templates":[]}`))
	}))
	defer server.Close()

	client, err := NewClient(ClientOptions{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	if _, err := client.FetchIndex(context.Background()); err == nil {
		t.Fatalf("expected empty template list to fail validation")
	}
}

func TestFetchIndexRejectsJSONFileEntries(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/templates/templates.jsonc" {
			http.NotFound(w, req)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
  "version":"1.0.0",
  "templates":[
    {"id":"github-push","name":"GitHub Push","provider":"github","event":"push","file":"github/github-push.json"}
  ]
}`))
	}))
	defer server.Close()

	client, err := NewClient(ClientOptions{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	if _, err := client.FetchIndex(context.Background()); err == nil {
		t.Fatalf("expected json index file entries to fail validation")
	}
}

func TestFetchRejectsOversizedPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/templates/templates.jsonc" {
			http.NotFound(w, req)
			return
		}
		w.WriteHeader(http.StatusOK)
		oversized := strings.Repeat("a", maxTemplateBytes+1)
		_, _ = w.Write([]byte(`{"version":"1.0.0","templates":[{"id":"github-push","name":"GitHub Push","provider":"github","event":"push","file":"github/github-push.jsonc"}],"padding":"` + oversized + `"}`))
	}))
	defer server.Close()

	client, err := NewClient(ClientOptions{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	if _, err := client.FetchIndex(context.Background()); err == nil {
		t.Fatalf("expected oversized payload to fail")
	}
}

func TestNewClientAppliesDefaultTimeout(t *testing.T) {
	client, err := NewClient(ClientOptions{})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	if client.httpClient.Timeout != DefaultHTTPTimeout {
		t.Fatalf("expected default timeout %s, got %s", DefaultHTTPTimeout, client.httpClient.Timeout)
	}

	customHTTPClient := &http.Client{Timeout: 0}
	client, err = NewClient(ClientOptions{HTTPClient: customHTTPClient})
	if err != nil {
		t.Fatalf("new client with custom client: %v", err)
	}
	if customHTTPClient.Timeout != 0 {
		t.Fatalf("expected input client timeout to remain unchanged, got %s", customHTTPClient.Timeout)
	}
	if client.httpClient.Timeout != DefaultHTTPTimeout {
		t.Fatalf("expected default timeout on unset custom client, got %s", client.httpClient.Timeout)
	}

	explicit := 2 * time.Second
	client, err = NewClient(ClientOptions{HTTPClient: &http.Client{Timeout: explicit}})
	if err != nil {
		t.Fatalf("new client with explicit timeout: %v", err)
	}
	if client.httpClient.Timeout != explicit {
		t.Fatalf("expected explicit timeout %s, got %s", explicit, client.httpClient.Timeout)
	}
}

func TestNewClientRejectsInvalidBaseURL(t *testing.T) {
	if _, err := NewClient(ClientOptions{BaseURL: "localhost:8080"}); err == nil {
		t.Fatalf("expected base URL without scheme to fail")
	}
	if _, err := NewClient(ClientOptions{BaseURL: "ftp://example.com"}); err == nil {
		t.Fatalf("expected unsupported scheme to fail")
	}
	if _, err := NewClient(ClientOptions{BaseURL: "https://"}); err == nil {
		t.Fatalf("expected base URL without host to fail")
	}
}

func TestFetchIndexUsesDefaultBaseURLAndJSONCPath(t *testing.T) {
	var gotURL string
	client, err := NewClient(ClientOptions{
		HTTPClient: &http.Client{
			Timeout: time.Second,
			Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				gotURL = request.URL.String()
				return &http.Response{
					StatusCode: http.StatusOK,
					Body: io.NopCloser(strings.NewReader(`{
  "version":"1.0.0",
  "templates":[
    {"id":"github-push","name":"GitHub Push","provider":"github","event":"push","file":"github/github-push.jsonc"}
  ]
}`)),
					Header: make(http.Header),
				}, nil
			}),
		},
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	if _, err := client.FetchIndex(context.Background()); err != nil {
		t.Fatalf("fetch index: %v", err)
	}

	wantURL := DefaultBaseURL + "/templates/templates.jsonc"
	if gotURL != wantURL {
		t.Fatalf("index request URL mismatch: got %q want %q", gotURL, wantURL)
	}
}
