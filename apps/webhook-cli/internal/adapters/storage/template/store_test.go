package template

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
)

func TestStoreSaveAndListRoundTrip(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	saved, err := store.Save(context.Background(), domain.TemplateMetadata{
		ID:       "github-push",
		Name:     "GitHub Push",
		Provider: "github",
		Event:    "push",
		File:     "github/github-push.jsonc",
	}, domain.WebhookTemplate{
		Method: "POST",
		Headers: []domain.HeaderEntry{
			{Key: "X-GitHub-Event", Value: "push"},
		},
		Body: []byte(`{"ok":true}`),
	}, "2026-02-22T10:00:00Z")
	if err != nil {
		t.Fatalf("save template: %v", err)
	}
	if saved.ID != "github-push" {
		t.Fatalf("saved id mismatch: got %q", saved.ID)
	}
	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 template, got %d", len(items))
	}
	if items[0].Metadata.Provider != "github" {
		t.Fatalf("provider mismatch: got %q", items[0].Metadata.Provider)
	}
}

func TestStoreSaveRejectsInvalidTemplateID(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	_, err = store.Save(context.Background(), domain.TemplateMetadata{
		ID:       "../escape",
		Name:     "Bad",
		Provider: "github",
		Event:    "push",
	}, domain.WebhookTemplate{Method: "POST"}, "2026-02-22T10:00:00Z")
	if err == nil {
		t.Fatalf("expected invalid id error")
	}
}

func TestStoreDeleteAllRemovesTemplates(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	_, err = store.Save(context.Background(), domain.TemplateMetadata{
		ID:       "github-push",
		Name:     "GitHub Push",
		Provider: "github",
		Event:    "push",
		File:     "github/github-push.jsonc",
	}, domain.WebhookTemplate{Method: "POST"}, "2026-02-22T10:00:00Z")
	if err != nil {
		t.Fatalf("save template: %v", err)
	}
	deleted, err := store.DeleteAll(context.Background())
	if err != nil {
		t.Fatalf("delete all templates: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("deleted count mismatch: got %d", deleted)
	}
	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected no templates, got %d", len(items))
	}
}

func TestStoreDeleteRemovesTemplate(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	_, err = store.Save(context.Background(), domain.TemplateMetadata{
		ID:       "github-push",
		Name:     "GitHub Push",
		Provider: "github",
		Event:    "push",
		File:     "github/github-push.jsonc",
	}, domain.WebhookTemplate{Method: "POST"}, "2026-02-22T10:00:00Z")
	if err != nil {
		t.Fatalf("save template: %v", err)
	}

	deleted, err := store.Delete(context.Background(), "github-push")
	if err != nil {
		t.Fatalf("delete template: %v", err)
	}
	if deleted.ID != "github-push" {
		t.Fatalf("deleted template mismatch: got %q", deleted.ID)
	}
	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected template to be deleted, got %d", len(items))
	}
}

func TestStoreDeleteReturnsNotFoundForMissingTemplate(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	_, err = store.Delete(context.Background(), "missing-template")
	if err == nil {
		t.Fatalf("expected missing template delete to fail")
	}
}

func TestStoreDeleteSkipsUnmanagedTemplateFile(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	providerDir := filepath.Join(baseDir, "github")
	if err := os.MkdirAll(providerDir, 0o700); err != nil {
		t.Fatalf("mkdir provider dir: %v", err)
	}
	targetPath := filepath.Join(providerDir, "github-push.jsonc")
	payload := `{
  "method": "POST",
  "_metadata": {}
}`
	if err := os.WriteFile(targetPath, []byte(payload), 0o600); err != nil {
		t.Fatalf("write unmanaged template file: %v", err)
	}

	_, err = store.Delete(context.Background(), "github-push")
	if err == nil {
		t.Fatalf("expected unmanaged template delete to fail")
	}
	if _, statErr := os.Stat(targetPath); statErr != nil {
		t.Fatalf("expected unmanaged file to remain, got stat error: %v", statErr)
	}
}

func TestStoreDeleteRejectsSymlinkPathEscape(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	providerDir := filepath.Join(baseDir, "github")
	if err := os.MkdirAll(providerDir, 0o700); err != nil {
		t.Fatalf("mkdir provider dir: %v", err)
	}

	externalDir := t.TempDir()
	externalTemplatePath := filepath.Join(externalDir, "github-push.jsonc")
	payload := `{
  "method": "POST",
  "_metadata": {
    "id": "github-push",
    "provider": "github"
  }
}`
	if err := os.WriteFile(externalTemplatePath, []byte(payload), 0o600); err != nil {
		t.Fatalf("write external template file: %v", err)
	}

	linkedTemplatePath := filepath.Join(providerDir, "github-push.jsonc")
	if err := os.Symlink(externalTemplatePath, linkedTemplatePath); err != nil {
		t.Fatalf("symlink template file: %v", err)
	}

	_, err = store.Delete(context.Background(), "github-push")
	if err == nil {
		t.Fatalf("expected symlink path escape to fail")
	}
	if !strings.Contains(err.Error(), "unsafe template path") {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, statErr := os.Stat(externalTemplatePath); statErr != nil {
		t.Fatalf("expected external file to remain, got stat error: %v", statErr)
	}
	if _, lstatErr := os.Lstat(linkedTemplatePath); lstatErr != nil {
		t.Fatalf("expected symlink file to remain, got lstat error: %v", lstatErr)
	}
}

func TestStoreDeleteRemovesResolvedTargetForManagedSymlink(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	linkedProviderDir := filepath.Join(baseDir, "a-link")
	targetProviderDir := filepath.Join(baseDir, "z-target")
	if err := os.MkdirAll(linkedProviderDir, 0o700); err != nil {
		t.Fatalf("mkdir linked provider dir: %v", err)
	}
	if err := os.MkdirAll(targetProviderDir, 0o700); err != nil {
		t.Fatalf("mkdir target provider dir: %v", err)
	}

	templateID := "github-push"
	managedPayload := `{
  "method": "POST",
  "_metadata": {
    "id": "github-push",
    "provider": "a-link"
  }
}`
	resolvedTargetPath := filepath.Join(targetProviderDir, templateID+".jsonc")
	if err := os.WriteFile(resolvedTargetPath, []byte(managedPayload), 0o600); err != nil {
		t.Fatalf("write managed target template: %v", err)
	}
	linkPath := filepath.Join(linkedProviderDir, templateID+".jsonc")
	if err := os.Symlink(resolvedTargetPath, linkPath); err != nil {
		t.Fatalf("create symlink template file: %v", err)
	}

	if _, err := store.Delete(context.Background(), templateID); err != nil {
		t.Fatalf("delete template through symlink alias: %v", err)
	}

	if _, statErr := os.Stat(resolvedTargetPath); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("expected resolved target to be deleted, got %v", statErr)
	}

	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected template to be fully deleted, got %d", len(items))
	}
}

func TestStoreDeleteAllSkipsUnmanagedJSONFiles(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	if _, err := store.Save(context.Background(), domain.TemplateMetadata{
		ID:       "github-push",
		Name:     "GitHub Push",
		Provider: "github",
		Event:    "push",
		File:     "github/github-push.jsonc",
	}, domain.WebhookTemplate{Method: "POST"}, "2026-02-22T10:00:00Z"); err != nil {
		t.Fatalf("save template: %v", err)
	}

	rootJSON := filepath.Join(baseDir, "unrelated.json")
	if err := os.WriteFile(rootJSON, []byte(`{"keep":true}`), 0o600); err != nil {
		t.Fatalf("write root json: %v", err)
	}
	nestedDir := filepath.Join(baseDir, "github", "nested")
	if err := os.MkdirAll(nestedDir, 0o700); err != nil {
		t.Fatalf("mkdir nested dir: %v", err)
	}
	providerJSON := filepath.Join(baseDir, "github", "unmanaged.json")
	if err := os.WriteFile(providerJSON, []byte(`{"keep":true}`), 0o600); err != nil {
		t.Fatalf("write provider json: %v", err)
	}
	nestedJSON := filepath.Join(nestedDir, "keep.json")
	if err := os.WriteFile(nestedJSON, []byte(`{"keep":true}`), 0o600); err != nil {
		t.Fatalf("write nested json: %v", err)
	}

	deleted, err := store.DeleteAll(context.Background())
	if err != nil {
		t.Fatalf("delete all templates: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("deleted count mismatch: got %d want 1", deleted)
	}
	if _, err := os.Stat(rootJSON); err != nil {
		t.Fatalf("expected root json to remain, got stat error: %v", err)
	}
	if _, err := os.Stat(providerJSON); err != nil {
		t.Fatalf("expected unmanaged provider json to remain, got stat error: %v", err)
	}
	if _, err := os.Stat(nestedJSON); err != nil {
		t.Fatalf("expected nested json to remain, got stat error: %v", err)
	}
}

func TestStoreListSkipsMalformedFiles(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	providerDir := filepath.Join(baseDir, "github")
	if err := os.MkdirAll(providerDir, 0o700); err != nil {
		t.Fatalf("mkdir provider dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(providerDir, "bad.jsonc"), []byte("{not json"), 0o600); err != nil {
		t.Fatalf("write malformed template file: %v", err)
	}
	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected malformed file to be skipped")
	}
}

func TestStoreListParsesJSONCFiles(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	providerDir := filepath.Join(baseDir, "github")
	if err := os.MkdirAll(providerDir, 0o700); err != nil {
		t.Fatalf("mkdir provider dir: %v", err)
	}
	payload := `{
  // local metadata
  "method": "POST",
  "headers": [
    { "key": "X-Test", "value": "ok" },
  ],
  "_metadata": {
    "id": "with-comments",
    "name": "With Comments",
    "provider": "github",
    "event": "push",
    "file": "github/with-comments.jsonc",
  },
}`
	if err := os.WriteFile(filepath.Join(providerDir, "with-comments.jsonc"), []byte(payload), 0o600); err != nil {
		t.Fatalf("write jsonc template: %v", err)
	}
	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one jsonc template, got %d", len(items))
	}
	if items[0].ID != "with-comments" {
		t.Fatalf("id mismatch: got %q", items[0].ID)
	}
}

func TestStoreListUsesFileModTimeWhenDownloadedAtMissing(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	providerDir := filepath.Join(baseDir, "github")
	if err := os.MkdirAll(providerDir, 0o700); err != nil {
		t.Fatalf("mkdir provider dir: %v", err)
	}
	templatePath := filepath.Join(providerDir, "legacy.jsonc")
	payload := `{
  "method": "POST",
  "_metadata": {
    "id": "legacy",
    "name": "Legacy",
    "provider": "github",
    "event": "push",
    "file": "github/legacy.jsonc"
  }
}`
	if err := os.WriteFile(templatePath, []byte(payload), 0o600); err != nil {
		t.Fatalf("write template: %v", err)
	}
	expected := time.Date(2024, time.December, 1, 3, 4, 5, 0, time.UTC)
	if err := os.Chtimes(templatePath, expected, expected); err != nil {
		t.Fatalf("set file mod time: %v", err)
	}

	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one template, got %d", len(items))
	}
	if items[0].DownloadedAt != expected.Format(time.RFC3339Nano) {
		t.Fatalf("downloadedAt mismatch: got %q want %q", items[0].DownloadedAt, expected.Format(time.RFC3339Nano))
	}
}

func TestStoreGetReturnsTemplateByID(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	_, err = store.Save(context.Background(), domain.TemplateMetadata{
		ID:       "github-push",
		Name:     "GitHub Push",
		Provider: "github",
		Event:    "push",
		File:     "github/github-push.jsonc",
	}, domain.WebhookTemplate{
		Method: "POST",
	}, "2026-02-22T10:00:00Z")
	if err != nil {
		t.Fatalf("save template: %v", err)
	}

	templateItem, err := store.Get(context.Background(), "github-push")
	if err != nil {
		t.Fatalf("get template: %v", err)
	}
	if templateItem.ID != "github-push" {
		t.Fatalf("template id mismatch: got %q", templateItem.ID)
	}
}

func TestStoreListTrimsUppercaseJSONCExtension(t *testing.T) {
	baseDir := t.TempDir()
	store, err := NewStore(baseDir)
	if err != nil {
		t.Fatalf("create store: %v", err)
	}
	providerDir := filepath.Join(baseDir, "github")
	if err := os.MkdirAll(providerDir, 0o700); err != nil {
		t.Fatalf("mkdir provider dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(providerDir, "Upper.JSONC"), []byte(`{
  "method": "POST",
  "_metadata": {
    "provider": "github",
    "event": "push",
    "file": "github/Upper.JSONC"
  }
}`), 0o600); err != nil {
		t.Fatalf("write uppercase jsonc template: %v", err)
	}

	items, err := store.List(context.Background())
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one template, got %d", len(items))
	}
	if items[0].ID != "Upper" {
		t.Fatalf("expected template id without extension, got %q", items[0].ID)
	}
}
