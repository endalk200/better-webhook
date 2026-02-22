package template

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

var safeTemplateTokenPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)

type Store struct {
	templatesDir string
}

type storedTemplateFile struct {
	URL         string               `json:"url,omitempty"`
	Method      string               `json:"method,omitempty"`
	Headers     []domain.HeaderEntry `json:"headers,omitempty"`
	Body        json.RawMessage      `json:"body,omitempty"`
	Provider    string               `json:"provider,omitempty"`
	Event       string               `json:"event,omitempty"`
	Description string               `json:"description,omitempty"`
	Metadata    storedTemplateMeta   `json:"_metadata"`
}

type storedTemplateMeta struct {
	domain.TemplateMetadata
	DownloadedAt string `json:"downloadedAt,omitempty"`
}

func NewStore(templatesDir string) (*Store, error) {
	if strings.TrimSpace(templatesDir) == "" {
		return nil, errors.New("templates directory cannot be empty")
	}
	return &Store{templatesDir: templatesDir}, nil
}

func (s *Store) List(ctx context.Context) ([]domain.LocalTemplate, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.templatesDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []domain.LocalTemplate{}, nil
		}
		return nil, fmt.Errorf("read templates directory: %w", err)
	}
	results := make([]domain.LocalTemplate, 0, len(entries))
	for _, entry := range entries {
		if err := checkContext(ctx); err != nil {
			return nil, err
		}
		if !entry.IsDir() {
			continue
		}
		provider := entry.Name()
		providerDir := filepath.Join(s.templatesDir, provider)
		files, err := os.ReadDir(providerDir)
		if err != nil {
			continue
		}
		for _, file := range files {
			if err := checkContext(ctx); err != nil {
				return nil, err
			}
			if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
				continue
			}
			fullPath := filepath.Join(providerDir, file.Name())
			content, readErr := os.ReadFile(fullPath)
			if readErr != nil {
				continue
			}
			var parsed storedTemplateFile
			if unmarshalErr := json.Unmarshal(content, &parsed); unmarshalErr != nil {
				continue
			}
			templateID := strings.TrimSpace(parsed.Metadata.ID)
			if templateID == "" {
				templateID = strings.TrimSuffix(file.Name(), ".json")
			}
			if !isValidTemplateToken(templateID) {
				continue
			}
			metaProvider := strings.TrimSpace(parsed.Metadata.Provider)
			if metaProvider == "" {
				metaProvider = provider
			}
			downloadedAt := strings.TrimSpace(parsed.Metadata.DownloadedAt)
			if downloadedAt == "" {
				downloadedAt = fallbackDownloadedAt(file)
			}
			method := strings.TrimSpace(parsed.Method)
			if method == "" {
				method = "POST"
			}

			metadata := parsed.Metadata.TemplateMetadata
			if strings.TrimSpace(metadata.ID) == "" {
				metadata.ID = templateID
			}
			if strings.TrimSpace(metadata.Name) == "" {
				metadata.Name = templateID
			}
			if strings.TrimSpace(metadata.Provider) == "" {
				metadata.Provider = metaProvider
			}
			if strings.TrimSpace(metadata.Event) == "" {
				metadata.Event = "unknown"
			}
			if strings.TrimSpace(metadata.File) == "" {
				metadata.File = filepath.ToSlash(filepath.Join(metaProvider, templateID+".json"))
			}

			results = append(results, domain.LocalTemplate{
				ID:       templateID,
				Metadata: metadata,
				Template: domain.WebhookTemplate{
					URL:         parsed.URL,
					Method:      method,
					Headers:     parsed.Headers,
					Body:        parsed.Body,
					Provider:    parsed.Provider,
					Event:       parsed.Event,
					Description: parsed.Description,
				},
				DownloadedAt: downloadedAt,
				FilePath:     fullPath,
			})
		}
	}
	return results, nil
}

func (s *Store) Save(
	ctx context.Context,
	metadata domain.TemplateMetadata,
	template domain.WebhookTemplate,
	downloadedAt string,
) (domain.LocalTemplate, error) {
	if err := checkContext(ctx); err != nil {
		return domain.LocalTemplate{}, err
	}
	templateID := strings.TrimSpace(metadata.ID)
	if !isValidTemplateToken(templateID) {
		return domain.LocalTemplate{}, domain.ErrInvalidTemplateID
	}
	provider := strings.TrimSpace(metadata.Provider)
	if provider == "" {
		provider = "custom"
	}
	if !isValidTemplateToken(provider) {
		return domain.LocalTemplate{}, fmt.Errorf("%w: provider %q is invalid", domain.ErrInvalidTemplateID, provider)
	}
	if strings.TrimSpace(downloadedAt) == "" {
		downloadedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	if strings.TrimSpace(metadata.Name) == "" {
		metadata.Name = templateID
	}
	metadata.ID = templateID
	metadata.Provider = provider
	if strings.TrimSpace(metadata.File) == "" {
		metadata.File = filepath.ToSlash(filepath.Join(provider, templateID+".json"))
	}
	if strings.TrimSpace(template.Method) == "" {
		template.Method = "POST"
	}

	filePath, err := s.safeTemplatePath(provider, templateID)
	if err != nil {
		return domain.LocalTemplate{}, err
	}
	if err := os.MkdirAll(filepath.Dir(filePath), 0o700); err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("create template directory: %w", err)
	}
	if err := os.Chmod(filepath.Dir(filePath), 0o700); err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("set template directory permissions: %w", err)
	}

	payload := storedTemplateFile{
		URL:         template.URL,
		Method:      template.Method,
		Headers:     template.Headers,
		Body:        template.Body,
		Provider:    template.Provider,
		Event:       template.Event,
		Description: template.Description,
		Metadata: storedTemplateMeta{
			TemplateMetadata: metadata,
			DownloadedAt:     downloadedAt,
		},
	}
	content, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("marshal template file: %w", err)
	}
	content = append(content, '\n')

	tempFile, err := os.CreateTemp(filepath.Dir(filePath), ".template-*.tmp")
	if err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("create template temp file: %w", err)
	}
	tempPath := tempFile.Name()
	renameSucceeded := false
	tempClosed := false
	defer func() {
		if !tempClosed {
			_ = tempFile.Close()
		}
		if !renameSucceeded {
			_ = os.Remove(tempPath)
		}
	}()
	if _, err := tempFile.Write(content); err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("write template temp file: %w", err)
	}
	if err := tempFile.Sync(); err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("sync template temp file: %w", err)
	}
	if err := tempFile.Close(); err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("close template temp file: %w", err)
	}
	tempClosed = true
	if err := os.Rename(tempPath, filePath); err != nil {
		return domain.LocalTemplate{}, fmt.Errorf("persist template file: %w", err)
	}
	renameSucceeded = true
	if err := os.Chmod(filePath, 0o600); err != nil {
		_ = os.Remove(filePath)
		return domain.LocalTemplate{}, fmt.Errorf("set template file permissions: %w", err)
	}

	return domain.LocalTemplate{
		ID:           templateID,
		Metadata:     metadata,
		Template:     template,
		DownloadedAt: downloadedAt,
		FilePath:     filePath,
	}, nil
}

func (s *Store) DeleteAll(ctx context.Context) (int, error) {
	if err := checkContext(ctx); err != nil {
		return 0, err
	}
	entries, err := os.ReadDir(s.templatesDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 0, nil
		}
		return 0, fmt.Errorf("read templates directory: %w", err)
	}

	deleted := 0
	for _, providerEntry := range entries {
		if err := checkContext(ctx); err != nil {
			return 0, err
		}
		if !providerEntry.IsDir() {
			continue
		}
		provider := providerEntry.Name()
		if !isValidTemplateToken(provider) {
			continue
		}
		providerDir := filepath.Join(s.templatesDir, provider)
		providerFiles, readErr := os.ReadDir(providerDir)
		if readErr != nil {
			if errors.Is(readErr, os.ErrNotExist) {
				continue
			}
			return 0, fmt.Errorf("read provider directory %q: %w", provider, readErr)
		}

		for _, file := range providerFiles {
			if err := checkContext(ctx); err != nil {
				return 0, err
			}
			if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
				continue
			}
			templateID := strings.TrimSuffix(file.Name(), ".json")
			if !isValidTemplateToken(templateID) {
				continue
			}
			filePath, pathErr := s.safeTemplatePath(provider, templateID)
			if pathErr != nil {
				continue
			}
			if !isManagedTemplateFile(filePath, provider, templateID) {
				continue
			}
			if removeErr := os.Remove(filePath); removeErr != nil {
				if errors.Is(removeErr, os.ErrNotExist) {
					continue
				}
				return 0, fmt.Errorf("delete template file %q: %w", filePath, removeErr)
			}
			deleted++
		}

		// Best effort cleanup of now-empty managed provider directory.
		_ = os.Remove(providerDir)
	}
	return deleted, nil
}

func (s *Store) safeTemplatePath(provider string, templateID string) (string, error) {
	baseDir := filepath.Clean(s.templatesDir)
	targetPath := filepath.Clean(filepath.Join(baseDir, provider, templateID+".json"))
	if targetPath != baseDir && !strings.HasPrefix(targetPath, baseDir+string(filepath.Separator)) {
		return "", fmt.Errorf("unsafe template path for provider %q and id %q", provider, templateID)
	}
	return targetPath, nil
}

func checkContext(ctx context.Context) error {
	if ctx == nil {
		return nil
	}
	return ctx.Err()
}

func fallbackDownloadedAt(entry os.DirEntry) string {
	info, err := entry.Info()
	if err != nil {
		return time.Unix(0, 0).UTC().Format(time.RFC3339Nano)
	}
	return info.ModTime().UTC().Format(time.RFC3339Nano)
}

func isManagedTemplateFile(path string, provider string, templateID string) bool {
	content, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	var parsed struct {
		Metadata struct {
			ID       string `json:"id"`
			Provider string `json:"provider"`
		} `json:"_metadata"`
	}
	if err := json.Unmarshal(content, &parsed); err != nil {
		return false
	}
	metadataID := strings.TrimSpace(parsed.Metadata.ID)
	metadataProvider := strings.TrimSpace(parsed.Metadata.Provider)
	if metadataID == "" && metadataProvider == "" {
		return false
	}
	if metadataID != "" && metadataID != templateID {
		return false
	}
	if metadataProvider != "" && metadataProvider != provider {
		return false
	}
	return true
}

func isValidTemplateToken(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || len(trimmed) > 128 {
		return false
	}
	if strings.Contains(trimmed, "..") || strings.Contains(trimmed, "/") || strings.Contains(trimmed, "\\") {
		return false
	}
	return safeTemplateTokenPattern.MatchString(trimmed)
}
