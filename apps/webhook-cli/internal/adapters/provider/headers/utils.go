package headers

import (
	"strings"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
)

func HasHeader(headers []domain.HeaderEntry, key string) bool {
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			return true
		}
	}
	return false
}

func HeaderValues(headers []domain.HeaderEntry, key string) []string {
	values := make([]string, 0)
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			values = append(values, header.Value)
		}
	}
	return values
}
