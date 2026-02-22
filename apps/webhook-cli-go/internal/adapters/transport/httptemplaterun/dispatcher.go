package httptemplaterun

import (
	"context"
	"errors"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/replay"
	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/templates"
	capturedomain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	templatedomain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

type Dispatcher struct {
	replayDispatcher appreplay.Dispatcher
}

func NewDispatcher(replayDispatcher appreplay.Dispatcher) *Dispatcher {
	if replayDispatcher == nil {
		panic("replay dispatcher cannot be nil")
	}
	return &Dispatcher{replayDispatcher: replayDispatcher}
}

func (d *Dispatcher) Dispatch(ctx context.Context, request apptemplates.DispatchRequest) (apptemplates.DispatchResult, error) {
	if d.replayDispatcher == nil {
		return apptemplates.DispatchResult{}, errors.New("replay dispatcher cannot be nil")
	}
	replayHeaders := make([]capturedomain.HeaderEntry, 0, len(request.Headers))
	for _, header := range request.Headers {
		replayHeaders = append(replayHeaders, capturedomain.HeaderEntry{
			Key:   header.Key,
			Value: header.Value,
		})
	}
	result, err := d.replayDispatcher.Dispatch(ctx, appreplay.DispatchRequest{
		Method:  request.Method,
		URL:     request.URL,
		Headers: replayHeaders,
		Body:    request.Body,
		Timeout: request.Timeout,
	})
	if err != nil {
		return apptemplates.DispatchResult{}, err
	}
	responseHeaders := make([]templatedomain.HeaderEntry, 0, len(result.Headers))
	for _, header := range result.Headers {
		responseHeaders = append(responseHeaders, templatedomain.HeaderEntry{
			Key:   header.Key,
			Value: header.Value,
		})
	}
	return apptemplates.DispatchResult{
		StatusCode:    result.StatusCode,
		StatusText:    result.StatusText,
		Headers:       responseHeaders,
		Body:          result.Body,
		BodyTruncated: result.BodyTruncated,
		Duration:      result.Duration,
	}, nil
}
