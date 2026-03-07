package ui

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

func FormatError(err error) string {
	if err == nil {
		return Error.Render("Error:")
	}
	return Error.Render("Error:") + " " + SanitizeForTerminal(err.Error())
}

func FormatTargetConnectivityError(err error) error {
	if err == nil {
		return nil
	}
	var urlErr *url.Error
	if !errors.As(err, &urlErr) {
		return nil
	}
	targetURL := strings.TrimSpace(urlErr.URL)
	if targetURL == "" {
		targetURL = "the target URL"
	}
	reason := strings.TrimSpace(urlErr.Err.Error())
	if reason == "" {
		reason = "request failed"
	}
	return fmt.Errorf("could not reach target URL %s: %s", targetURL, reason)
}
