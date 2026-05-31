package templates

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestInstallBuiltinCatalogWritesVisibleJSONCTemplates(t *testing.T) {
	manager, err := NewManager(t.TempDir())
	if err != nil {
		t.Fatalf("expected manager: %v", err)
	}
	manifest, err := manager.InstallBuiltin()
	if err != nil {
		t.Fatalf("expected builtin install to succeed: %v", err)
	}
	if manifest.CatalogVersion != BuiltinCatalogVersion {
		t.Fatalf("unexpected catalog version %q", manifest.CatalogVersion)
	}

	path := filepath.Join(manager.Home, "official", BuiltinCatalogVersion, "stripe", "payment_intent.succeeded.jsonc")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("expected template file to exist: %v", err)
	}
	if !strings.Contains(string(data), "Managed better-webhook official template") {
		t.Fatalf("expected JSONC comment in managed template, got %s", data)
	}
}

func TestRenderReplacesRuntimePlaceholders(t *testing.T) {
	template := BuiltinManifest().Templates[0]
	path := filepath.Join(t.TempDir(), "template.jsonc")
	if err := os.WriteFile(path, template.Bytes, 0o644); err != nil {
		t.Fatal(err)
	}
	loaded, err := LoadTemplateFile(path)
	if err != nil {
		t.Fatalf("expected template to load: %v", err)
	}
	rendered := Render(loaded, time.Unix(1_700_000_000, 0))
	body := string(rendered.Body)
	if strings.Contains(body, "{{") {
		t.Fatalf("expected placeholders to be replaced, got %s", body)
	}
	if !strings.Contains(body, `"created":1700000000`) {
		t.Fatalf("expected unix timestamp replacement, got %s", body)
	}
}

func TestRenderReplacesPathAndQueryPlaceholders(t *testing.T) {
	rendered := Render(Template{
		Method: "POST",
		Path:   "/deliveries/{{uuid}}",
		Query:  "created={{timestamp_unix}}",
		Body:   `{"id":"{{uuid}}"}`,
	}, time.Unix(1_700_000_000, 0))

	if strings.Contains(rendered.Path, "{{") || !strings.HasPrefix(rendered.Path, "/deliveries/") {
		t.Fatalf("expected rendered path placeholder, got %q", rendered.Path)
	}
	if rendered.Query != "created=1700000000" {
		t.Fatalf("expected rendered query placeholder, got %q", rendered.Query)
	}
}

func TestForkCreatesUserOwnedTemplateCopy(t *testing.T) {
	manager, err := NewManager(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.InstallBuiltin(); err != nil {
		t.Fatal(err)
	}
	template, path, err := manager.Fork("github/ping", "my/github-ping")
	if err != nil {
		t.Fatalf("expected fork to succeed: %v", err)
	}
	if template.Source != "user" {
		t.Fatalf("expected user-owned source, got %q", template.Source)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected fork file to exist: %v", err)
	}
}

func TestInstallFromManifestRequiresAndVerifiesSignature(t *testing.T) {
	sourceDir := t.TempDir()
	template := Template{
		SchemaVersion:          "1",
		ID:                     "custom/event",
		Name:                   "Custom Event",
		Version:                "1.0.0",
		Source:                 "official",
		VerificationCompatible: false,
		Method:                 "POST",
		Body:                   `{"ok":true}`,
	}
	templateBytes, err := json.Marshal(template)
	if err != nil {
		t.Fatal(err)
	}
	templatePath := filepath.Join(sourceDir, "custom.jsonc")
	if err := os.WriteFile(templatePath, templateBytes, 0o644); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(templateBytes)
	manifest := Manifest{
		SchemaVersion:  "1",
		CatalogVersion: "2026.01.01",
		Templates: []ManifestEntry{
			{ID: "custom/event", Path: "custom.jsonc", SHA256: hex.EncodeToString(sum[:])},
		},
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	manifest.Signature = hex.EncodeToString(ed25519.Sign(privateKey, canonicalManifestPayload(manifest)))
	manifestBytes, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	manifestPath := filepath.Join(sourceDir, "manifest.json")
	if err := os.WriteFile(manifestPath, manifestBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	manager, err := NewManager(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.InstallFromManifest(manifestPath, ""); err == nil {
		t.Fatal("expected external catalog without trusted public key to fail")
	}
	installed, err := manager.InstallFromManifest(manifestPath, hex.EncodeToString(publicKey))
	if err != nil {
		t.Fatalf("expected signed manifest to install: %v", err)
	}
	if len(installed.Templates) != 1 || !installed.Templates[0].Verified {
		t.Fatalf("expected verified installed template, got %#v", installed.Templates)
	}
}

func TestInstallFromManifestRejectsEscapingTemplatePaths(t *testing.T) {
	sourceDir := t.TempDir()
	manifest := Manifest{
		SchemaVersion:  "1",
		CatalogVersion: "2026.01.02",
		Templates: []ManifestEntry{
			{ID: "custom/event", Path: "../outside.jsonc", SHA256: strings.Repeat("0", 64)},
		},
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	manifest.Signature = hex.EncodeToString(ed25519.Sign(privateKey, canonicalManifestPayload(manifest)))
	manifestBytes, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	manifestPath := filepath.Join(sourceDir, "manifest.json")
	if err := os.WriteFile(manifestPath, manifestBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	manager, err := NewManager(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_, err = manager.InstallFromManifest(manifestPath, hex.EncodeToString(publicKey))
	if err == nil || !strings.Contains(err.Error(), "escapes catalog directory") {
		t.Fatalf("expected escaping path to be rejected, got %v", err)
	}
}
