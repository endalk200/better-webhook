package jsonc

import (
	"context"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

func TestStoreDeleteByExactID(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	record := testCaptureRecord("abc12345-0000-0000-0000-000000000000", "2026-02-20T12:00:00Z")
	if _, err := store.Save(context.Background(), record); err != nil {
		t.Fatalf("save capture: %v", err)
	}

	deleted, err := store.DeleteByIDOrPrefix(context.Background(), record.ID)
	if err != nil {
		t.Fatalf("delete capture: %v", err)
	}
	if deleted.Capture.ID != record.ID {
		t.Fatalf("deleted wrong capture: got %q want %q", deleted.Capture.ID, record.ID)
	}

	_, err = store.ResolveByIDOrPrefix(context.Background(), record.ID)
	if !errors.Is(err, domain.ErrCaptureNotFound) {
		t.Fatalf("expected not found after delete, got %v", err)
	}
}

func TestStoreDeleteByFile(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	record := testCaptureRecord("cab005e5-0000-0000-0000-000000000000", "2026-02-20T12:00:00Z")
	saved, err := store.Save(context.Background(), record)
	if err != nil {
		t.Fatalf("save capture: %v", err)
	}

	if err := store.DeleteByFile(context.Background(), saved.File); err != nil {
		t.Fatalf("delete capture by file: %v", err)
	}

	_, err = store.ResolveByIDOrPrefix(context.Background(), record.ID)
	if !errors.Is(err, domain.ErrCaptureNotFound) {
		t.Fatalf("expected not found after delete by file, got %v", err)
	}
}

func TestStoreDeleteRejectsAmbiguousPrefix(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	first := testCaptureRecord("abc11111-0000-0000-0000-000000000000", "2026-02-20T12:00:00Z")
	second := testCaptureRecord("abc22222-0000-0000-0000-000000000000", "2026-02-20T12:00:01Z")
	if _, err := store.Save(context.Background(), first); err != nil {
		t.Fatalf("save first capture: %v", err)
	}
	if _, err := store.Save(context.Background(), second); err != nil {
		t.Fatalf("save second capture: %v", err)
	}

	_, err = store.DeleteByIDOrPrefix(context.Background(), "abc")
	if !errors.Is(err, domain.ErrAmbiguousSelector) {
		t.Fatalf("expected ambiguous selector error, got %v", err)
	}
}

func TestStoreDeleteMissingID(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	_, err = store.DeleteByIDOrPrefix(context.Background(), "does-not-exist")
	if !errors.Is(err, domain.ErrCaptureNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestSafeCapturePathRejectsTraversal(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	_, err = store.safeCapturePath("../outside.jsonc")
	if err == nil {
		t.Fatalf("expected traversal path to be rejected")
	}
}

func TestListDoesNotCreateDirectoryWhenMissing(t *testing.T) {
	baseDir := t.TempDir()
	missingDir := filepath.Join(baseDir, "captures")

	store, err := NewStore(missingDir, nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	captures, err := store.List(context.Background(), 20)
	if err != nil {
		t.Fatalf("list captures from missing dir: %v", err)
	}
	if len(captures) != 0 {
		t.Fatalf("expected no captures from missing dir, got %d", len(captures))
	}

	_, statErr := os.Stat(missingDir)
	if !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("expected list not to create missing directory, stat err: %v", statErr)
	}
}

func TestStoreSaveListResolveRoundTrip(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	record := testCaptureRecord("aa112233-0000-0000-0000-000000000000", "2026-02-20T12:00:00Z")
	saved, err := store.Save(context.Background(), record)
	if err != nil {
		t.Fatalf("save capture: %v", err)
	}
	if saved.Capture.ID != record.ID {
		t.Fatalf("saved wrong capture ID: got %q want %q", saved.Capture.ID, record.ID)
	}

	listed, err := store.List(context.Background(), 5)
	if err != nil {
		t.Fatalf("list captures: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected one capture, got %d", len(listed))
	}
	if listed[0].Capture.ID != record.ID {
		t.Fatalf("listed wrong capture: got %q want %q", listed[0].Capture.ID, record.ID)
	}

	resolved, err := store.ResolveByIDOrPrefix(context.Background(), record.ID[:8])
	if err != nil {
		t.Fatalf("resolve capture by prefix: %v", err)
	}
	if resolved.Capture.ID != record.ID {
		t.Fatalf("resolved wrong capture: got %q want %q", resolved.Capture.ID, record.ID)
	}
}

func TestStoreSaveUsesInjectedClockWhenTimestampInvalid(t *testing.T) {
	fallbackNow := time.Date(2026, time.February, 21, 15, 4, 5, 123456789, time.UTC)
	store, err := NewStore(t.TempDir(), fixedClock{now: fallbackNow}, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	record := testCaptureRecord("feedbeef-0000-0000-0000-000000000000", "not-a-timestamp")
	saved, err := store.Save(context.Background(), record)
	if err != nil {
		t.Fatalf("save capture: %v", err)
	}

	expectedPrefix := fallbackNow.Format("2006-01-02T15-04-05.000000000Z")
	if filepath.Ext(saved.File) != ".jsonc" {
		t.Fatalf("expected .jsonc file extension, got %q", saved.File)
	}
	if !strings.HasPrefix(filepath.Base(saved.File), expectedPrefix) {
		t.Fatalf("expected filename to use injected clock timestamp prefix %q, got %q", expectedPrefix, saved.File)
	}
}

func TestStoreResolveRejectsEmptySelector(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	_, err = store.ResolveByIDOrPrefix(context.Background(), "   ")
	if !errors.Is(err, domain.ErrInvalidSelector) {
		t.Fatalf("expected invalid selector error, got %v", err)
	}
}

func TestStoreListHonorsCancelledContext(t *testing.T) {
	store, err := NewStore(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = store.List(ctx, 10)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled error, got %v", err)
	}
}

func testCaptureRecord(id string, timestamp string) domain.CaptureRecord {
	body := []byte(`{"ok":true}`)
	return domain.CaptureRecord{
		ID:            id,
		Timestamp:     timestamp,
		Method:        "POST",
		URL:           "/webhooks/test",
		Path:          "/webhooks/test",
		Headers:       []domain.HeaderEntry{{Key: "Content-Type", Value: "application/json"}},
		ContentType:   "application/json",
		ContentLength: int64(len(body)),
		RawBodyBase64: base64.StdEncoding.EncodeToString(body),
		Provider:      domain.ProviderUnknown,
		Meta: domain.CaptureMeta{
			StoredAt:           time.Now().UTC().Format(time.RFC3339Nano),
			BodyEncoding:       domain.BodyEncodingBase64,
			CaptureToolVersion: "test",
		},
	}
}

type fixedClock struct {
	now time.Time
}

func (c fixedClock) Now() time.Time {
	return c.now
}
