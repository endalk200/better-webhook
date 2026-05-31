package templates

import (
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

type RenderedRequest struct {
	Method  string
	Path    string
	Query   string
	Headers []domain.Header
	Body    []byte
}

func Render(template Template, now time.Time) RenderedRequest {
	if now.IsZero() {
		now = time.Now()
	}
	replacements := map[string]string{
		"{{timestamp_unix}}": strconv.FormatInt(now.UTC().Unix(), 10),
		"{{timestamp_iso}}":  now.UTC().Format(time.RFC3339),
	}
	body := replaceRuntimePlaceholders(string(template.Body), replacements)
	headers := make([]domain.Header, 0, len(template.Headers))
	for _, header := range template.Headers {
		headers = append(headers, domain.Header{
			Name:  header.Name,
			Value: replaceRuntimePlaceholders(header.Value, replacements),
		})
	}
	return RenderedRequest{
		Method:  template.Method,
		Path:    replaceRuntimePlaceholders(template.Path, replacements),
		Query:   replaceRuntimePlaceholders(template.Query, replacements),
		Headers: headers,
		Body:    []byte(body),
	}
}

func replaceRuntimePlaceholders(value string, replacements map[string]string) string {
	value = replaceAll(value, replacements)
	for strings.Contains(value, "{{uuid}}") {
		value = strings.Replace(value, "{{uuid}}", randomID(), 1)
	}
	return value
}

func replaceAll(value string, replacements map[string]string) string {
	for token, replacement := range replacements {
		value = strings.ReplaceAll(value, token, replacement)
	}
	return value
}

func randomID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
	}
	return hex.EncodeToString(buf)
}
