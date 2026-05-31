package capture

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

type Store struct {
	Root string
}

var captureIDPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$`)

func NewStore(projectRoot string, cfg domain.CaptureConfig) Store {
	root := cfg.StorePath
	if root == "" {
		root = filepath.Join(projectRoot, domain.ConfigDirName, "captures")
	}
	if !filepath.IsAbs(root) {
		root = filepath.Join(projectRoot, root)
	}
	return Store{Root: root}
}

func (s Store) Save(capture domain.Capture) error {
	if err := validateCaptureID(capture.ID); err != nil {
		return err
	}
	if capture.SchemaVersion == "" {
		capture.SchemaVersion = domain.SchemaVersion
	}
	if err := os.MkdirAll(s.Root, 0o700); err != nil {
		return err
	}
	path, err := s.path(capture.ID)
	if err != nil {
		return err
	}
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("capture %q already exists and captures are immutable", capture.ID)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	data, err := json.MarshalIndent(capture, "", "\t")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

func (s Store) Load(id string) (domain.Capture, error) {
	path, err := s.path(id)
	if err != nil {
		return domain.Capture{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return domain.Capture{}, err
	}
	var capture domain.Capture
	if err := json.Unmarshal(data, &capture); err != nil {
		return domain.Capture{}, err
	}
	return capture, nil
}

func (s Store) List(endpointID string) ([]domain.Capture, error) {
	if _, err := os.Stat(s.Root); errors.Is(err, os.ErrNotExist) {
		return []domain.Capture{}, nil
	} else if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.Root)
	if err != nil {
		return nil, err
	}
	captures := make([]domain.Capture, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		capture, err := s.Load(entry.Name()[:len(entry.Name())-len(".json")])
		if err != nil {
			return nil, err
		}
		if endpointID == "" || capture.EndpointID == endpointID {
			captures = append(captures, capture)
		}
	}
	sort.Slice(captures, func(i, j int) bool {
		return captures[i].CapturedAt > captures[j].CapturedAt
	})
	return captures, nil
}

func (s Store) Delete(id string) error {
	path, err := s.path(id)
	if err != nil {
		return err
	}
	return os.Remove(path)
}

func (s Store) DeleteEndpointCaptures(endpointID string) (int, error) {
	captures, err := s.List(endpointID)
	if err != nil {
		return 0, err
	}
	for _, item := range captures {
		if err := s.Delete(item.ID); err != nil && !errors.Is(err, os.ErrNotExist) {
			return 0, err
		}
	}
	return len(captures), nil
}

func (s Store) Prune(retentionDays int, now time.Time) (int, error) {
	if retentionDays <= 0 {
		return 0, nil
	}
	if now.IsZero() {
		now = time.Now()
	}
	captures, err := s.List("")
	if err != nil {
		return 0, err
	}
	cutoff := now.Add(-time.Duration(retentionDays) * 24 * time.Hour)
	deleted := 0
	for _, item := range captures {
		capturedAt, err := time.Parse(time.RFC3339Nano, item.CapturedAt)
		if err != nil {
			continue
		}
		if capturedAt.Before(cutoff) {
			if err := s.Delete(item.ID); err != nil && !errors.Is(err, os.ErrNotExist) {
				return deleted, err
			}
			deleted++
		}
	}
	return deleted, nil
}

func BuildCapture(id, endpointID, providerName string, request domain.CapturedRequest, analysis domain.CaptureAnalysis, forward *domain.ForwardResult, now time.Time) domain.Capture {
	if now.IsZero() {
		now = time.Now()
	}
	return domain.Capture{
		SchemaVersion: domain.SchemaVersion,
		ID:            id,
		EndpointID:    endpointID,
		Provider:      providerName,
		CapturedAt:    domain.NowString(now),
		Request:       request,
		Forward:       forward,
		Analysis:      analysis,
	}
}

func CapturedRequest(method, path, rawQuery string, headers []domain.Header, body []byte) domain.CapturedRequest {
	sum := sha256.Sum256(body)
	return domain.CapturedRequest{
		Method:     method,
		Path:       path,
		RawQuery:   rawQuery,
		Headers:    headers,
		BodyBase64: base64.StdEncoding.EncodeToString(body),
		BodySHA256: hex.EncodeToString(sum[:]),
	}
}

func BodyBytes(request domain.CapturedRequest) ([]byte, error) {
	return base64.StdEncoding.DecodeString(request.BodyBase64)
}

func (s Store) path(id string) (string, error) {
	if err := validateCaptureID(id); err != nil {
		return "", err
	}
	return filepath.Join(s.Root, id+".json"), nil
}

func validateCaptureID(id string) error {
	if !captureIDPattern.MatchString(id) {
		return fmt.Errorf("capture id %q must be 1-128 characters and contain only letters, numbers, dots, underscores, or hyphens", id)
	}
	return nil
}
