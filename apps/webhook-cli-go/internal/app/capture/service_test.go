package capture

import (
	"context"
	"encoding/base64"
	"testing"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

func TestServiceIngestBuildsAndStoresCapture(t *testing.T) {
	repo := &captureRepoStub{
		baseRecord: domain.CaptureRecord{
			ID:        "id-1",
			Timestamp: time.Date(2026, time.February, 21, 12, 0, 0, 0, time.UTC).Format(time.RFC3339Nano),
			Provider:  domain.ProviderUnknown,
			Meta: domain.CaptureMeta{
				StoredAt:           time.Date(2026, time.February, 21, 12, 0, 0, 0, time.UTC).Format(time.RFC3339Nano),
				BodyEncoding:       domain.BodyEncodingBase64,
				CaptureToolVersion: "test",
			},
		},
	}
	detector := &detectorStub{
		result: domain.DetectionResult{Provider: domain.ProviderGitHub, Confidence: 1},
	}
	service := NewService(repo, detector, nil, "test-version")

	body := []byte(`{"ok":true}`)
	result, err := service.Ingest(context.Background(), IngestRequest{
		Method: "post",
		URL:    "/webhooks/github",
		Path:   "/webhooks/github",
		Headers: []domain.HeaderEntry{
			{Key: "Content-Type", Value: "application/json"},
		},
		RemoteAddr: "127.0.0.1",
		Body:       body,
	})
	if err != nil {
		t.Fatalf("ingest capture: %v", err)
	}
	if result.Saved.Capture.Provider != domain.ProviderGitHub {
		t.Fatalf("expected detected provider, got %q", result.Saved.Capture.Provider)
	}
	if result.Saved.Capture.Method != "POST" {
		t.Fatalf("expected uppercased method, got %q", result.Saved.Capture.Method)
	}
	decoded, decodeErr := base64.StdEncoding.DecodeString(result.Saved.Capture.RawBodyBase64)
	if decodeErr != nil {
		t.Fatalf("decode raw body: %v", decodeErr)
	}
	if string(decoded) != string(body) {
		t.Fatalf("expected raw body to be preserved")
	}
	if len(result.Saved.Capture.ParsedJSONPreview) == 0 {
		t.Fatalf("expected parsed JSON preview to be set for small json payload")
	}
}

func TestNewServicePanicsWhenRepoNil(t *testing.T) {
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatalf("expected panic when repo is nil")
		}
	}()
	_ = NewService(nil, nil, nil, "test-version")
}

type captureRepoStub struct {
	baseRecord domain.CaptureRecord
}

func (s *captureRepoStub) EnsureStorageDir(context.Context) error {
	return nil
}

func (s *captureRepoStub) BuildBaseRecord(string) domain.CaptureRecord {
	return s.baseRecord
}

func (s *captureRepoStub) Save(_ context.Context, capture domain.CaptureRecord) (domain.CaptureFile, error) {
	return domain.CaptureFile{
		File:    "capture.jsonc",
		Capture: capture,
	}, nil
}

type detectorStub struct {
	result domain.DetectionResult
}

func (d *detectorStub) Detect(domain.DetectionContext) domain.DetectionResult {
	return d.result
}
