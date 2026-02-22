package httpurl

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

func ValidateAbsolute(rawURL string) error {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return errors.New("url cannot be empty")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return errors.New("must include scheme and host")
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("scheme must be http or https")
	}
	return nil
}
