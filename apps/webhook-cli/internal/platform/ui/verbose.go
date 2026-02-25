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
		headersToRows(result.SentHeaders),
		headersToRows(result.Response.Headers),
		result.Response.Body,
		result.Response.BodyTruncated,
	)
}

func PrintTemplateRunVerboseOutput(out io.Writer, result apptemplates.RunResult) {
	printVerboseRequestResponse(
		out,
		headersToRows(result.SentHeaders),
		headersToRows(result.Response.Headers),
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

type verboseHeaderEntry interface {
	capturedomain.HeaderEntry | templatedomain.HeaderEntry
}

func headersToRows[T verboseHeaderEntry](headers []T) [][]string {
	rows := make([][]string, 0, len(headers))
	for _, header := range headers {
		switch value := any(header).(type) {
		case capturedomain.HeaderEntry:
			rows = append(rows, []string{value.Key, value.Value})
		case templatedomain.HeaderEntry:
			rows = append(rows, []string{value.Key, value.Value})
		}
	}
	return rows
}
