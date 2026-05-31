package gateway

import (
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/capture"
	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
	"github.com/endalk200/better-webhook/packages/cli/internal/project"
)

func TestGatewayCapturesAndTransparentlyForwardsKnownRoute(t *testing.T) {
	var receivedMethod, receivedQuery, receivedBody, receivedHeader, receivedConnectionScopedHeader, receivedConnection string
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		receivedMethod = request.Method
		receivedQuery = request.URL.RawQuery
		receivedHeader = request.Header.Get("X-Test")
		receivedConnectionScopedHeader = request.Header.Get("X-Connection-Scoped")
		receivedConnection = request.Header.Get("Connection")
		body, _ := io.ReadAll(request.Body)
		receivedBody = string(body)
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write([]byte("accepted"))
	}))
	t.Cleanup(upstream.Close)

	root := t.TempDir()
	resolved := project.ResolvedProject{
		Root:       root,
		ConfigPath: filepath.Join(root, ".better-webhook", "project.json"),
		Config: domain.ProjectConfig{
			SchemaVersion: domain.SchemaVersion,
			Name:          "demo",
			Gateway:       domain.GatewayConfig{ListenAddress: "127.0.0.1", Port: 0},
			Capture:       domain.CaptureConfig{RetentionDays: 7},
			Endpoints: []domain.EndpointProfile{
				{
					ID:        "stripe-main",
					Mode:      domain.EndpointModeProvider,
					Provider:  "stripe",
					TargetURL: upstream.URL + "/target?token=keep",
					Route:     "/webhooks/stripe",
				},
			},
		},
	}
	store := capture.NewStore(root, resolved.Config.Capture)
	server := Server{
		Project:  resolved,
		Captures: store,
		Now: func() time.Time {
			return time.Unix(1_700_000_000, 0)
		},
	}

	request := httptest.NewRequest(http.MethodPost, "/webhooks/stripe?debug=1", stringsReader("raw-body"))
	request.Header.Add("X-Test", "preserved")
	request.Header.Add("Connection", "X-Connection-Scoped")
	request.Header.Add("X-Connection-Scoped", "drop")
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected upstream status to be mirrored, got %d with %q", recorder.Code, recorder.Body.String())
	}
	if recorder.Body.String() != "accepted" {
		t.Fatalf("expected upstream body to be mirrored, got %q", recorder.Body.String())
	}
	if receivedMethod != http.MethodPost || receivedBody != "raw-body" || receivedHeader != "preserved" || receivedQuery != "debug=1&token=keep" {
		t.Fatalf("unexpected forwarded request method=%s query=%s header=%s body=%s", receivedMethod, receivedQuery, receivedHeader, receivedBody)
	}
	if receivedConnection != "" || receivedConnectionScopedHeader != "" {
		t.Fatalf("expected hop-by-hop headers to be filtered, got connection=%q scoped=%q", receivedConnection, receivedConnectionScopedHeader)
	}

	captures, err := store.List("stripe-main")
	if err != nil {
		t.Fatalf("expected captures to list: %v", err)
	}
	if len(captures) != 1 {
		t.Fatalf("expected one capture, got %d", len(captures))
	}
	if captures[0].Request.Path != "/webhooks/stripe" || captures[0].Request.RawQuery != "debug=1" {
		t.Fatalf("unexpected captured request: %#v", captures[0].Request)
	}
}

func TestGatewayRejectsUnknownRoutesWithoutCapture(t *testing.T) {
	root := t.TempDir()
	resolved := project.ResolvedProject{
		Root: root,
		Config: domain.ProjectConfig{
			SchemaVersion: domain.SchemaVersion,
			Name:          "demo",
			Capture:       domain.CaptureConfig{RetentionDays: 7},
		},
	}
	store := capture.NewStore(root, resolved.Config.Capture)
	server := Server{Project: resolved, Captures: store}

	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/missing", stringsReader("{}")))

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected missing route to return 404, got %d", recorder.Code)
	}
	captures, err := store.List("")
	if err != nil {
		t.Fatal(err)
	}
	if len(captures) != 0 {
		t.Fatalf("expected no captures for unknown route, got %d", len(captures))
	}
}

func TestGatewayPersistsCaptureWhenForwardingFails(t *testing.T) {
	root := t.TempDir()
	resolved := project.ResolvedProject{
		Root: root,
		Config: domain.ProjectConfig{
			SchemaVersion: domain.SchemaVersion,
			Name:          "demo",
			Capture:       domain.CaptureConfig{RetentionDays: 7},
			Endpoints: []domain.EndpointProfile{
				{
					ID:        "generic-main",
					Mode:      domain.EndpointModeGeneric,
					TargetURL: "http://127.0.0.1:1/unreachable",
					Route:     "/incoming",
				},
			},
		},
	}
	store := capture.NewStore(root, resolved.Config.Capture)
	server := Server{Project: resolved, Captures: store}

	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/incoming", stringsReader("raw")))

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected forwarding failure to return 502, got %d", recorder.Code)
	}
	captures, err := store.List("generic-main")
	if err != nil {
		t.Fatal(err)
	}
	if len(captures) != 1 {
		t.Fatalf("expected failed forward to still store capture, got %d", len(captures))
	}
}

func stringsReader(value string) io.Reader {
	return strings.NewReader(value)
}
