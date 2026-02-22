package httptemplates

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"regexp"
	"strings"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

const (
	DefaultBaseURL     = "https://raw.githubusercontent.com/endalk200/better-webhook/main"
	DefaultHTTPTimeout = 15 * time.Second
)

var safeTemplateFilePattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+(/[a-zA-Z0-9._-]+)*$`)

type ClientOptions struct {
	BaseURL    string
	HTTPClient *http.Client
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(options ClientOptions) (*Client, error) {
	baseURL := strings.TrimSpace(options.BaseURL)
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	baseURL = strings.TrimRight(baseURL, "/")
	var httpClient *http.Client
	if options.HTTPClient == nil {
		httpClient = &http.Client{Timeout: DefaultHTTPTimeout}
	} else {
		clientCopy := *options.HTTPClient
		if clientCopy.Timeout <= 0 {
			clientCopy.Timeout = DefaultHTTPTimeout
		}
		httpClient = &clientCopy
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: httpClient,
	}, nil
}

func (c *Client) FetchIndex(ctx context.Context) (domain.TemplatesIndex, error) {
	body, err := c.fetch(ctx, "/templates/templates.json")
	if err != nil {
		return domain.TemplatesIndex{}, err
	}
	var index domain.TemplatesIndex
	if err := json.Unmarshal(body, &index); err != nil {
		return domain.TemplatesIndex{}, fmt.Errorf("parse templates index: %w", err)
	}
	if err := validateIndex(index); err != nil {
		return domain.TemplatesIndex{}, err
	}
	return index, nil
}

func (c *Client) FetchTemplate(ctx context.Context, templateFile string) (domain.WebhookTemplate, error) {
	normalizedFile, err := sanitizeTemplateFile(templateFile)
	if err != nil {
		return domain.WebhookTemplate{}, err
	}
	body, err := c.fetch(ctx, "/templates/"+normalizedFile)
	if err != nil {
		return domain.WebhookTemplate{}, err
	}
	var template domain.WebhookTemplate
	if err := json.Unmarshal(body, &template); err != nil {
		return domain.WebhookTemplate{}, fmt.Errorf("parse template payload: %w", err)
	}
	if strings.TrimSpace(template.Method) == "" {
		template.Method = "POST"
	}
	return template, nil
}

func (c *Client) fetch(ctx context.Context, relativePath string) ([]byte, error) {
	url := c.baseURL + relativePath
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create template request: %w", err)
	}
	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request template content: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request template content: unexpected status %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("read template response body: %w", err)
	}
	return body, nil
}

func validateIndex(index domain.TemplatesIndex) error {
	for _, metadata := range index.Templates {
		if strings.TrimSpace(metadata.ID) == "" {
			return errors.New("template metadata id cannot be empty")
		}
		if strings.TrimSpace(metadata.Provider) == "" {
			return errors.New("template metadata provider cannot be empty")
		}
		if strings.TrimSpace(metadata.Event) == "" {
			return errors.New("template metadata event cannot be empty")
		}
		if _, err := sanitizeTemplateFile(metadata.File); err != nil {
			return fmt.Errorf("template metadata file is invalid: %w", err)
		}
	}
	return nil
}

func sanitizeTemplateFile(templateFile string) (string, error) {
	trimmed := strings.TrimSpace(templateFile)
	if trimmed == "" {
		return "", errors.New("template file cannot be empty")
	}
	if strings.ContainsAny(trimmed, "?#%\\") {
		return "", errors.New("template file contains unsupported characters")
	}
	if containsControlChars(trimmed) {
		return "", errors.New("template file contains control characters")
	}
	if strings.Contains(trimmed, "..") {
		return "", errors.New("template file contains invalid path traversal")
	}
	if !safeTemplateFilePattern.MatchString(trimmed) {
		return "", errors.New("template file contains unsupported characters")
	}
	normalized := path.Clean("/" + trimmed)
	normalized = strings.TrimPrefix(normalized, "/")
	if strings.TrimSpace(normalized) == "" || normalized == "." || strings.Contains(normalized, "..") {
		return "", errors.New("template file path is invalid")
	}
	if !safeTemplateFilePattern.MatchString(normalized) {
		return "", errors.New("template file contains unsupported characters")
	}
	return normalized, nil
}

func containsControlChars(value string) bool {
	for _, char := range value {
		if char < 0x20 || char == 0x7f {
			return true
		}
	}
	return false
}
