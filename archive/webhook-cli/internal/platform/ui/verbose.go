package ui

import (
	"fmt"
	"io"

	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/replay"
	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	capturedomain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
	templatedomain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
)

func PrintReplayVerboseOutput(out io.Writer, result appreplay.ReplayResult) {
	printVerboseRequestResponse(
		out,
		captureHeadersToRows(result.SentHeaders),
		captureHeadersToRows(result.Response.Headers),
		result.Response.Body,
		result.Response.BodyTruncated,
	)
}

func PrintTemplateRunVerboseOutput(out io.Writer, result apptemplates.RunResult) {
	printVerboseRequestResponse(
		out,
		templateHeadersToRows(result.SentHeaders),
		templateHeadersToRows(result.Response.Headers),
		result.Response.Body,
		result.Response.BodyTruncated,
	)
}

func printVerboseRequestResponse(
	out io.Writer,
	requestHeaders [][]string,
	responseHeaders [][]string,
	responseBody []byte,
	responseBodyTruncated bool,
) {
	if out == nil {
		return
	}

	if len(requestHeaders) > 0 {
		_, _ = fmt.Fprintln(out)
		_, _ = fmt.Fprintln(out, Bold.Render("Request headers"))
		_, _ = fmt.Fprintln(out, NewKeyValueTable(requestHeaders))
	}

	if len(responseHeaders) > 0 {
		_, _ = fmt.Fprintln(out)
		_, _ = fmt.Fprintln(out, Bold.Render("Response headers"))
		_, _ = fmt.Fprintln(out, NewKeyValueTable(responseHeaders))
	}

	if len(responseBody) == 0 {
		return
	}
	_, _ = fmt.Fprintln(out)
	_, _ = fmt.Fprintln(out, Bold.Render("Response body"))
	_, _ = fmt.Fprintln(out, FormatBodyPreview(responseBody, responseBodyTruncated))
}

func captureHeadersToRows(headers []capturedomain.HeaderEntry) [][]string {
	rows := make([][]string, 0, len(headers))
	for _, header := range headers {
		rows = append(rows, []string{header.Key, header.Value})
	}
	return rows
}

func templateHeadersToRows(headers []templatedomain.HeaderEntry) [][]string {
	rows := make([][]string, 0, len(headers))
	for _, header := range headers {
		rows = append(rows, []string{header.Key, header.Value})
	}
	return rows
}
