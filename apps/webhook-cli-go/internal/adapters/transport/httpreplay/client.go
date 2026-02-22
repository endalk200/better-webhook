package httpreplay

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"time"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/replay"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

const defaultMaxResponseBodyBytes int64 = 1 << 20

type Client struct {
	httpClient           *http.Client
	maxResponseBodyBytes int64
}

func NewClient(httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		httpClient:           httpClient,
		maxResponseBodyBytes: defaultMaxResponseBodyBytes,
	}
}

func (c *Client) Dispatch(ctx context.Context, request appreplay.DispatchRequest) (appreplay.DispatchResult, error) {
	if request.Timeout <= 0 {
		return appreplay.DispatchResult{}, errors.New("timeout must be greater than 0")
	}

	dispatchCtx := ctx
	var cancel context.CancelFunc
	if dispatchCtx == nil {
		dispatchCtx = context.Background()
	}
	dispatchCtx, cancel = context.WithTimeout(dispatchCtx, request.Timeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(dispatchCtx, request.Method, request.URL, bytes.NewReader(request.Body))
	if err != nil {
		return appreplay.DispatchResult{}, fmt.Errorf("build replay request: %w", err)
	}
	for _, header := range request.Headers {
		if header.Key == "" {
			continue
		}
		httpReq.Header.Add(header.Key, header.Value)
	}

	startedAt := time.Now()
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return appreplay.DispatchResult{}, fmt.Errorf("send replay request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, bodyTruncated, err := readBoundedResponseBody(resp.Body, c.maxResponseBodyBytes)
	if err != nil {
		return appreplay.DispatchResult{}, fmt.Errorf("read replay response body: %w", err)
	}

	return appreplay.DispatchResult{
		StatusCode:    resp.StatusCode,
		StatusText:    http.StatusText(resp.StatusCode),
		Headers:       normalizeHeaders(resp.Header),
		Body:          body,
		BodyTruncated: bodyTruncated,
		Duration:      time.Since(startedAt),
	}, nil
}

func readBoundedResponseBody(reader io.Reader, maxBytes int64) ([]byte, bool, error) {
	limitedReader := io.LimitReader(reader, maxBytes+1)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, false, err
	}
	if int64(len(body)) > maxBytes {
		return body[:maxBytes], true, nil
	}
	return body, false, nil
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
