package gateway

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/capture"
	"github.com/endalk200/better-webhook/packages/cli/internal/delivery"
	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
	"github.com/endalk200/better-webhook/packages/cli/internal/project"
	"github.com/endalk200/better-webhook/packages/cli/internal/provider"
)

type Server struct {
	Project    project.ResolvedProject
	Captures   capture.Store
	HTTPClient *http.Client
	Now        func() time.Time
}

func (s Server) Handler() http.Handler {
	return http.HandlerFunc(s.handle)
}

func (s Server) ListenAndServe(ctx context.Context) error {
	addr := fmt.Sprintf("%s:%d", s.Project.Config.Gateway.ListenAddress, s.Project.Config.Gateway.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
		err := <-errCh
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}

func (s Server) handle(writer http.ResponseWriter, request *http.Request) {
	endpoint, ok := endpointByRoute(s.Project.Config, request.URL.Path)
	if !ok {
		http.Error(writer, fmt.Sprintf("no better-webhook endpoint route for %s", request.URL.Path), http.StatusNotFound)
		return
	}

	body, err := io.ReadAll(request.Body)
	if err != nil {
		http.Error(writer, "failed to read request body", http.StatusBadRequest)
		return
	}

	headers := delivery.HeaderList(request.Header)
	analysis := provider.Analyze(endpoint, headers)
	now := time.Now()
	if s.Now != nil {
		now = s.Now()
	}
	rawCapture := capture.BuildCapture(
		randomID(),
		endpoint.ID,
		endpoint.Provider,
		capture.CapturedRequest(request.Method, request.URL.Path, request.URL.RawQuery, headers, body),
		analysis,
		nil,
		now,
	)
	if err := s.Captures.Save(rawCapture); err != nil {
		http.Error(writer, "failed to persist capture: "+err.Error(), http.StatusInternalServerError)
		return
	}

	targetURL, err := delivery.URLWithRequestTarget(endpoint.TargetURL, "", request.URL.RawQuery)
	if err != nil {
		http.Error(writer, "invalid endpoint target: "+err.Error(), http.StatusInternalServerError)
		return
	}
	forwardResponse, forwardErr := s.forward(request.Context(), request.Method, targetURL, headers, body)
	if forwardErr != nil {
		http.Error(writer, "forwarding failed: "+forwardErr.Error(), http.StatusBadGateway)
		return
	}
	defer func() {
		_ = forwardResponse.Body.Close()
	}()
	if err := delivery.CopyResponse(writer, forwardResponse); err != nil {
		http.Error(writer, err.Error(), http.StatusBadGateway)
		return
	}
}

func (s Server) forward(ctx context.Context, method, targetURL string, headers []domain.Header, body []byte) (*http.Response, error) {
	client := s.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	httpRequest, err := http.NewRequestWithContext(ctx, method, targetURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for _, header := range headers {
		httpRequest.Header.Add(header.Name, header.Value)
	}
	return client.Do(httpRequest)
}

func endpointByRoute(cfg domain.ProjectConfig, path string) (domain.EndpointProfile, bool) {
	for _, endpoint := range cfg.Endpoints {
		if endpoint.Route == path {
			return endpoint, true
		}
	}
	return domain.EndpointProfile{}, false
}

func randomID() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("cap_%d", time.Now().UnixNano())
	}
	return "cap_" + hex.EncodeToString(buf)
}

func LocalAddr(listener net.Listener) string {
	if listener == nil {
		return ""
	}
	return listener.Addr().String()
}
