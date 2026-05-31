package capture

import (
	"strings"
	"testing"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

func TestStoreRejectsPathTraversalCaptureIDs(t *testing.T) {
	store := NewStore(t.TempDir(), domain.CaptureConfig{RetentionDays: 7})

	for _, id := range []string{"../project", "nested/capture", `nested\capture`, ""} {
		if err := store.Delete(id); err == nil || !strings.Contains(err.Error(), "capture id") {
			t.Fatalf("expected capture id %q to be rejected, got %v", id, err)
		}
		if _, err := store.Load(id); err == nil || !strings.Contains(err.Error(), "capture id") {
			t.Fatalf("expected capture id %q to be rejected on load, got %v", id, err)
		}
	}

	item := BuildCapture(
		"../project",
		"endpoint",
		"",
		CapturedRequest("POST", "/incoming", "", nil, []byte("{}")),
		domain.CaptureAnalysis{},
		nil,
		time.Unix(1, 0),
	)
	if err := store.Save(item); err == nil || !strings.Contains(err.Error(), "capture id") {
		t.Fatalf("expected invalid capture id to be rejected on save, got %v", err)
	}
}
