package template

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

type Cache struct {
	cacheFile string
}

type cachedIndexFile struct {
	Index    domain.TemplatesIndex `json:"index"`
	CachedAt string                `json:"cachedAt"`
}

func NewCache(cacheFile string) (*Cache, error) {
	if strings.TrimSpace(cacheFile) == "" {
		return nil, errors.New("cache file cannot be empty")
	}
	return &Cache{cacheFile: cacheFile}, nil
}

func (c *Cache) Get(ctx context.Context) (apptemplates.CachedIndex, bool, error) {
	if err := checkContext(ctx); err != nil {
		return apptemplates.CachedIndex{}, false, err
	}
	content, err := os.ReadFile(c.cacheFile)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return apptemplates.CachedIndex{}, false, nil
		}
		return apptemplates.CachedIndex{}, false, fmt.Errorf("read templates cache file: %w", err)
	}
	parsed := cachedIndexFile{}
	if err := json.Unmarshal(content, &parsed); err != nil {
		return apptemplates.CachedIndex{}, false, fmt.Errorf("parse templates cache file: %w", err)
	}
	cachedAt, err := time.Parse(time.RFC3339Nano, parsed.CachedAt)
	if err != nil {
		return apptemplates.CachedIndex{}, false, fmt.Errorf("parse templates cache timestamp: %w", err)
	}
	return apptemplates.CachedIndex{
		Index:    parsed.Index,
		CachedAt: cachedAt,
	}, true, nil
}

func (c *Cache) Set(ctx context.Context, value apptemplates.CachedIndex) error {
	if err := checkContext(ctx); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(c.cacheFile), 0o700); err != nil {
		return fmt.Errorf("create cache directory: %w", err)
	}
	if err := os.Chmod(filepath.Dir(c.cacheFile), 0o700); err != nil {
		return fmt.Errorf("set cache directory permissions: %w", err)
	}

	payload := cachedIndexFile{
		Index:    value.Index,
		CachedAt: value.CachedAt.UTC().Format(time.RFC3339Nano),
	}
	content, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal templates cache: %w", err)
	}
	content = append(content, '\n')
	tempPath := c.cacheFile + ".tmp"
	if err := os.WriteFile(tempPath, content, 0o600); err != nil {
		return fmt.Errorf("write templates cache temp file: %w", err)
	}
	renameSucceeded := false
	defer func() {
		if !renameSucceeded {
			_ = os.Remove(tempPath)
		}
	}()
	if err := os.Rename(tempPath, c.cacheFile); err != nil {
		return fmt.Errorf("persist templates cache file: %w", err)
	}
	renameSucceeded = true
	if err := os.Chmod(c.cacheFile, 0o600); err != nil {
		_ = os.Remove(c.cacheFile)
		return fmt.Errorf("set templates cache permissions: %w", err)
	}
	return nil
}

func (c *Cache) Clear(ctx context.Context) error {
	if err := checkContext(ctx); err != nil {
		return err
	}
	if err := os.Remove(c.cacheFile); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove templates cache file: %w", err)
	}
	return nil
}
