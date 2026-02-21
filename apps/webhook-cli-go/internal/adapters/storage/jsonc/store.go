package jsonc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
	platformid "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/id"
	platformtime "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/time"
	"github.com/tailscale/hujson"
)

type Store struct {
	capturesDir string
	clock       platformtime.Clock
	idGenerator platformid.Generator
}

func NewStore(capturesDir string, clock platformtime.Clock, idGenerator platformid.Generator) (*Store, error) {
	if strings.TrimSpace(capturesDir) == "" {
		return nil, errors.New("captures directory cannot be empty")
	}
	if clock == nil {
		clock = platformtime.SystemClock{}
	}
	if idGenerator == nil {
		idGenerator = platformid.UUIDGenerator{}
	}

	return &Store{
		capturesDir: capturesDir,
		clock:       clock,
		idGenerator: idGenerator,
	}, nil
}

func (s *Store) BuildBaseRecord(toolVersion string) domain.CaptureRecord {
	now := s.clock.Now().UTC()
	id := s.idGenerator.NewID()

	return domain.CaptureRecord{
		ID:        id,
		Timestamp: now.Format(time.RFC3339Nano),
		Provider:  domain.ProviderUnknown,
		Meta: domain.CaptureMeta{
			StoredAt:     now.Format(time.RFC3339Nano),
			BodyEncoding: domain.BodyEncodingBase64,
			CaptureTool:  toolVersion,
		},
	}
}

func (s *Store) Save(ctx context.Context, capture domain.CaptureRecord) (domain.CaptureFile, error) {
	if err := checkContext(ctx); err != nil {
		return domain.CaptureFile{}, err
	}
	if err := s.EnsureStorageDir(ctx); err != nil {
		return domain.CaptureFile{}, err
	}

	filename := storageFileName(capture.Timestamp, capture.ID)
	content, err := marshalJSONC(capture)
	if err != nil {
		return domain.CaptureFile{}, fmt.Errorf("marshal capture: %w", err)
	}

	targetPath, err := s.safeCapturePath(filename)
	if err != nil {
		return domain.CaptureFile{}, err
	}
	tempPath := targetPath + ".tmp"

	if err := checkContext(ctx); err != nil {
		return domain.CaptureFile{}, err
	}
	if err := os.WriteFile(tempPath, content, 0o600); err != nil {
		return domain.CaptureFile{}, fmt.Errorf("write temp capture file: %w", err)
	}
	renameSucceeded := false
	defer func() {
		if !renameSucceeded {
			_ = os.Remove(tempPath)
		}
	}()
	if err := checkContext(ctx); err != nil {
		return domain.CaptureFile{}, err
	}
	if err := os.Rename(tempPath, targetPath); err != nil {
		_ = os.Remove(tempPath)
		return domain.CaptureFile{}, fmt.Errorf("persist capture file: %w", err)
	}
	renameSucceeded = true
	if err := os.Chmod(targetPath, 0o600); err != nil {
		return domain.CaptureFile{}, fmt.Errorf("set capture file permissions: %w", err)
	}

	return domain.CaptureFile{
		File:    filename,
		Capture: capture,
	}, nil
}

func (s *Store) List(ctx context.Context, limit int) ([]domain.CaptureFile, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}
	if limit <= 0 {
		return nil, domain.ErrInvalidLimit
	}

	files, err := s.captureFilesSortedDesc(ctx)
	if err != nil {
		return nil, err
	}

	results := make([]domain.CaptureFile, 0, limit)
	for _, file := range files {
		if err := checkContext(ctx); err != nil {
			return nil, err
		}
		if len(results) >= limit {
			break
		}

		captureFile, err := s.readCaptureFile(ctx, file)
		if err != nil {
			continue
		}
		results = append(results, captureFile)
	}

	return results, nil
}

func (s *Store) ResolveByIDOrPrefix(ctx context.Context, selector string) (domain.CaptureFile, error) {
	if err := checkContext(ctx); err != nil {
		return domain.CaptureFile{}, err
	}
	trimmedSelector := strings.TrimSpace(selector)
	if trimmedSelector == "" {
		return domain.CaptureFile{}, domain.ErrInvalidSelector
	}

	files, err := s.captureFilesSortedDesc(ctx)
	if err != nil {
		return domain.CaptureFile{}, err
	}

	matches := make([]domain.CaptureFile, 0, 4)
	for _, file := range files {
		if err := checkContext(ctx); err != nil {
			return domain.CaptureFile{}, err
		}

		captureFile, readErr := s.readCaptureFile(ctx, file)
		if readErr != nil {
			continue
		}

		if captureFile.Capture.ID == trimmedSelector || strings.HasPrefix(captureFile.Capture.ID, trimmedSelector) {
			matches = append(matches, captureFile)
		}
	}

	if len(matches) == 0 {
		return domain.CaptureFile{}, domain.ErrCaptureNotFound
	}
	if len(matches) > 1 {
		return domain.CaptureFile{}, domain.ErrAmbiguousSelector
	}

	return matches[0], nil
}

func (s *Store) DeleteByIDOrPrefix(ctx context.Context, selector string) (domain.CaptureFile, error) {
	if err := checkContext(ctx); err != nil {
		return domain.CaptureFile{}, err
	}
	captureFile, err := s.ResolveByIDOrPrefix(ctx, selector)
	if err != nil {
		return domain.CaptureFile{}, err
	}

	targetPath, err := s.safeCapturePath(captureFile.File)
	if err != nil {
		return domain.CaptureFile{}, err
	}
	if err := checkContext(ctx); err != nil {
		return domain.CaptureFile{}, err
	}
	if err := os.Remove(targetPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return domain.CaptureFile{}, domain.ErrCaptureNotFound
		}
		return domain.CaptureFile{}, fmt.Errorf("delete capture file: %w", err)
	}

	return captureFile, nil
}

func (s *Store) EnsureStorageDir(ctx context.Context) error {
	if err := checkContext(ctx); err != nil {
		return err
	}
	if err := os.MkdirAll(s.capturesDir, 0o700); err != nil {
		return fmt.Errorf("create captures directory: %w", err)
	}
	if err := os.Chmod(s.capturesDir, 0o700); err != nil {
		return fmt.Errorf("set captures directory permissions: %w", err)
	}
	return nil
}

func (s *Store) captureFilesSortedDesc(ctx context.Context) ([]string, error) {
	files, err := s.captureFilesSortedAsc(ctx)
	if err != nil {
		return nil, err
	}
	for left, right := 0, len(files)-1; left < right; left, right = left+1, right-1 {
		files[left], files[right] = files[right], files[left]
	}
	return files, nil
}

func (s *Store) captureFilesSortedAsc(ctx context.Context) ([]string, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.capturesDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("read captures directory: %w", err)
	}

	files := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".jsonc") {
			continue
		}
		files = append(files, name)
	}
	sort.Strings(files)
	return files, nil
}

func (s *Store) readCaptureFile(ctx context.Context, file string) (domain.CaptureFile, error) {
	if err := checkContext(ctx); err != nil {
		return domain.CaptureFile{}, err
	}
	path, err := s.safeCapturePath(file)
	if err != nil {
		return domain.CaptureFile{}, err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return domain.CaptureFile{}, err
	}

	standardized, err := hujson.Standardize(content)
	if err != nil {
		return domain.CaptureFile{}, err
	}

	var captureRecord domain.CaptureRecord
	if err := json.Unmarshal(standardized, &captureRecord); err != nil {
		return domain.CaptureFile{}, err
	}

	return domain.CaptureFile{
		File:    file,
		Capture: captureRecord,
	}, nil
}

func (s *Store) safeCapturePath(file string) (string, error) {
	if strings.Contains(file, string(filepath.Separator)) {
		return "", fmt.Errorf("invalid file name: %q", file)
	}

	baseDir := filepath.Clean(s.capturesDir)
	fullPath := filepath.Join(baseDir, file)
	cleanPath := filepath.Clean(fullPath)
	if cleanPath != baseDir && !strings.HasPrefix(cleanPath, baseDir+string(filepath.Separator)) {
		return "", fmt.Errorf("unsafe capture path: %q", file)
	}

	return cleanPath, nil
}

func checkContext(ctx context.Context) error {
	if ctx == nil {
		return nil
	}
	return ctx.Err()
}

func storageFileName(timestamp, id string) string {
	parsedTime, err := time.Parse(time.RFC3339Nano, timestamp)
	if err != nil {
		parsedTime = time.Now().UTC()
	}
	shortID := id
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	return fmt.Sprintf("%s_%s.jsonc", parsedTime.UTC().Format("2006-01-02T15-04-05.000000000Z"), shortID)
}

func marshalJSONC(captureRecord domain.CaptureRecord) ([]byte, error) {
	raw, err := json.MarshalIndent(captureRecord, "", "  ")
	if err != nil {
		return nil, err
	}

	var out bytes.Buffer
	if _, err := out.Write(raw); err != nil {
		return nil, err
	}
	if err := out.WriteByte('\n'); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
