package httpcapture

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	appcapture "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/capture"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/logging"
)

const maxRequestBodyBytes int64 = 1 << 20

var (
	errRequestBodyTooLarge = errors.New("request body exceeds maximum size")
	errServerNotStarted    = errors.New("server not started")
)

type Logger interface {
	Printf(format string, values ...interface{})
}

type RouteResolver interface {
	ResolvePath(req *http.Request) string
}

type passthroughRouteResolver struct{}

func (r passthroughRouteResolver) ResolvePath(req *http.Request) string {
	return req.URL.Path
}

type ServerOptions struct {
	Host          string
	Port          int
	Verbose       bool
	CaptureSvc    *appcapture.Service
	Logger        Logger
	RouteResolver RouteResolver
}

type Server struct {
	options       ServerOptions
	captureSvc    *appcapture.Service
	logger        Logger
	routeResolver RouteResolver
	httpServer    *http.Server
	listener      net.Listener
	serveErrCh    chan struct{}
	serveErrOnce  sync.Once
	serveErrMu    sync.RWMutex
	serveErr      error
	started       bool
}

func NewServer(options ServerOptions) (*Server, error) {
	if options.CaptureSvc == nil {
		return nil, errors.New("capture service cannot be nil")
	}

	logger := options.Logger
	if logger == nil {
		logger = log.Default()
	}

	routeResolver := options.RouteResolver
	if routeResolver == nil {
		routeResolver = passthroughRouteResolver{}
	}

	return &Server{
		options:       options,
		captureSvc:    options.CaptureSvc,
		logger:        logger,
		routeResolver: routeResolver,
		serveErrCh:    make(chan struct{}),
	}, nil
}

func (s *Server) Start() (int, error) {
	if err := s.captureSvc.EnsureStorageDir(context.Background()); err != nil {
		return 0, err
	}

	address := fmt.Sprintf("%s:%d", s.options.Host, s.options.Port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return 0, fmt.Errorf("listen on %s: %w", address, err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleCaptureRequest)

	s.httpServer = &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	s.listener = listener
	s.serveErrMu.Lock()
	s.started = true
	s.serveErrMu.Unlock()

	go func() {
		serveErr := s.httpServer.Serve(listener)
		if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			s.setServeErr(serveErr)
			return
		}
		s.setServeErr(nil)
	}()

	actualPort := listener.Addr().(*net.TCPAddr).Port
	return actualPort, nil
}

func (s *Server) Stop(ctx context.Context) error {
	if s.httpServer == nil {
		return nil
	}
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) Wait() error {
	s.serveErrMu.RLock()
	started := s.started
	s.serveErrMu.RUnlock()
	if !started {
		return errServerNotStarted
	}

	<-s.serveErrCh
	s.serveErrMu.RLock()
	defer s.serveErrMu.RUnlock()
	return s.serveErr
}

func (s *Server) Addr() string {
	if s.listener == nil {
		return fmt.Sprintf("%s:%d", s.options.Host, s.options.Port)
	}
	return s.listener.Addr().String()
}

func (s *Server) handleCaptureRequest(w http.ResponseWriter, req *http.Request) {
	if err := req.Context().Err(); err != nil {
		writeJSON(w, http.StatusRequestTimeout, map[string]string{
			"error": "request cancelled",
		})
		return
	}

	clientID := clientIdentity(req.RemoteAddr)

	bodyBytes, err := s.readRequestBody(req)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			writeJSON(w, http.StatusRequestTimeout, map[string]string{
				"error": "request cancelled",
			})
			return
		}
		if errors.Is(err, errRequestBodyTooLarge) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{
				"error": "request body too large",
			})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "failed to read request body",
		})
		return
	}

	headers := normalizeHeaders(req.Header)
	resolvedPath := s.routeResolver.ResolvePath(req)
	if strings.TrimSpace(resolvedPath) == "" {
		resolvedPath = req.URL.Path
	}

	result, err := s.captureSvc.Ingest(req.Context(), appcapture.IngestRequest{
		Method:     req.Method,
		URL:        req.URL.RequestURI(),
		Path:       resolvedPath,
		Headers:    headers,
		RemoteAddr: clientID,
		Body:       bodyBytes,
	})
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			writeJSON(w, http.StatusRequestTimeout, map[string]string{
				"error": "request cancelled",
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to store capture",
		})
		return
	}

	if result.RelayErr != nil && s.options.Verbose {
		s.logger.Printf("relay hook error: %s", logging.SanitizeForLog(result.RelayErr.Error()))
	}
	if s.options.Verbose {
		s.logger.Printf(
			"captured %s %s provider=%s file=%s body=%dB",
			logging.SanitizeForLog(result.Saved.Capture.Method),
			logging.SanitizeForLog(logging.TruncateForLog(result.Saved.Capture.Path, 256)),
			logging.SanitizeForLog(result.Saved.Capture.Provider),
			logging.SanitizeForLog(result.Saved.File),
			result.Saved.Capture.ContentLength,
		)
	}

	provider := result.Saved.Capture.Provider
	if provider == "" {
		provider = domain.ProviderUnknown
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "captured",
		"id":       result.Saved.Capture.ID,
		"provider": provider,
		"file":     result.Saved.File,
	})
}

func (s *Server) readRequestBody(req *http.Request) ([]byte, error) {
	limitedReader := io.LimitReader(req.Body, maxRequestBodyBytes+1)
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, err
	}
	if int64(len(bodyBytes)) > maxRequestBodyBytes {
		return nil, errRequestBodyTooLarge
	}
	if err := req.Context().Err(); err != nil {
		return nil, err
	}
	return bodyBytes, nil
}

func (s *Server) setServeErr(err error) {
	s.serveErrOnce.Do(func() {
		s.serveErrMu.Lock()
		s.serveErr = err
		s.serveErrMu.Unlock()
		close(s.serveErrCh)
	})
}

func normalizeHeaders(source http.Header) []domain.HeaderEntry {
	keys := make([]string, 0, len(source))
	for key := range source {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	headers := make([]domain.HeaderEntry, 0, len(source))
	for _, key := range keys {
		values := source[key]
		for _, value := range values {
			headers = append(headers, domain.HeaderEntry{
				Key:   key,
				Value: value,
			})
		}
	}
	return headers
}

func clientIdentity(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}

func writeJSON(w http.ResponseWriter, status int, payload map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
