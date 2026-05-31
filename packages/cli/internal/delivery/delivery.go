package delivery

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

type Client struct {
	HTTPClient *http.Client
}

type Request struct {
	Method  string
	URL     string
	Headers []domain.Header
	Body    []byte
}

func (c Client) Send(ctx context.Context, request Request) domain.DeliveryResult {
	client := c.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	start := time.Now()
	httpRequest, err := http.NewRequestWithContext(ctx, request.Method, request.URL, bytes.NewReader(request.Body))
	if err != nil {
		return domain.DeliveryResult{TargetURL: request.URL, DurationMillis: elapsed(start), Error: err.Error()}
	}
	applyHeaders(httpRequest.Header, request.Headers)
	response, err := client.Do(httpRequest)
	if err != nil {
		return domain.DeliveryResult{TargetURL: request.URL, DurationMillis: elapsed(start), Error: err.Error()}
	}
	defer func() {
		_ = response.Body.Close()
	}()

	body, _ := io.ReadAll(io.LimitReader(response.Body, 64*1024))
	return domain.DeliveryResult{
		TargetURL:      request.URL,
		StatusCode:     response.StatusCode,
		DurationMillis: elapsed(start),
		ResponseBody:   string(body),
		Headers:        responseHeaders(response.Header),
	}
}

func URLWithRequestTarget(targetURL, path, rawQuery string) (string, error) {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return "", err
	}
	if path != "" {
		basePath := strings.TrimRight(parsed.Path, "/")
		requestPath := "/" + strings.TrimLeft(path, "/")
		if basePath == "" || basePath == "/" {
			parsed.Path = requestPath
		} else {
			parsed.Path = basePath + requestPath
		}
	}
	if rawQuery != "" {
		parsed.RawQuery = rawQuery
	}
	return parsed.String(), nil
}

func ForwardURL(targetURL, inboundPath, route, rawQuery string) (string, error) {
	relative := strings.TrimPrefix(inboundPath, route)
	if route == "/" {
		relative = strings.TrimPrefix(inboundPath, "/")
	}
	if relative == "" {
		relative = "/"
	}
	return URLWithRequestTarget(targetURL, relative, rawQuery)
}

func applyHeaders(header http.Header, values []domain.Header) {
	for _, item := range values {
		if shouldSkipRequestHeader(item.Name) {
			continue
		}
		header.Add(item.Name, item.Value)
	}
}

func responseHeaders(header http.Header) []domain.Header {
	var values []domain.Header
	for name, headerValues := range header {
		for _, value := range headerValues {
			values = append(values, domain.Header{Name: name, Value: value})
		}
	}
	return values
}

func HeaderList(header http.Header) []domain.Header {
	var values []domain.Header
	for name, headerValues := range header {
		for _, value := range headerValues {
			values = append(values, domain.Header{Name: name, Value: value})
		}
	}
	return values
}

func CopyResponse(writer http.ResponseWriter, result *http.Response) error {
	for name, values := range result.Header {
		for _, value := range values {
			writer.Header().Add(name, value)
		}
	}
	writer.WriteHeader(result.StatusCode)
	_, err := io.Copy(writer, result.Body)
	if err != nil {
		return fmt.Errorf("copy response: %w", err)
	}
	return nil
}

func shouldSkipRequestHeader(name string) bool {
	switch strings.ToLower(name) {
	case "connection", "content-length", "host", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func elapsed(start time.Time) int64 {
	return time.Since(start).Milliseconds()
}
