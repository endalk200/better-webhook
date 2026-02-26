package toml

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
)

func TestWriteDefaultConfigCreatesCommentedTemplate(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "nested", "config.toml")

	result, err := NewWriter().WriteDefaultConfig(configPath, false)
	if err != nil {
		t.Fatalf("write default config: %v", err)
	}
	if !result.Created {
		t.Fatalf("expected Created=true")
	}
	if result.Overwritten {
		t.Fatalf("expected Overwritten=false")
	}
	if result.Path != configPath {
		t.Fatalf("path mismatch: got %q want %q", result.Path, configPath)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("read config file: %v", err)
	}
	content := string(data)
	assertContainsAll(t, content,
		"# Better Webhook CLI configuration",
		"BETTER_WEBHOOK_CONFIG_PATH",
		"captures_dir",
		"templates_dir",
		"log_level",
		"command flag > environment variable > this file > built-in default",
	)
}

func TestWriteDefaultConfigRejectsOverwriteWithoutForce(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.toml")
	if err := os.WriteFile(configPath, []byte("log_level = \"warn\"\n"), 0o600); err != nil {
		t.Fatalf("seed config file: %v", err)
	}

	_, err := NewWriter().WriteDefaultConfig(configPath, false)
	if err == nil {
		t.Fatalf("expected write without force to fail for existing config")
	}
	if !errors.Is(err, runtime.ErrConfigFileAlreadyExists) {
		t.Fatalf("expected ErrConfigFileAlreadyExists, got %v", err)
	}
}

func TestWriteDefaultConfigOverwritesWhenForced(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.toml")
	original := "log_level = \"warn\"\n"
	if err := os.WriteFile(configPath, []byte(original), 0o600); err != nil {
		t.Fatalf("seed config file: %v", err)
	}

	result, err := NewWriter().WriteDefaultConfig(configPath, true)
	if err != nil {
		t.Fatalf("write default config with force: %v", err)
	}
	if result.Created {
		t.Fatalf("expected Created=false when overwriting")
	}
	if !result.Overwritten {
		t.Fatalf("expected Overwritten=true when force is set")
	}

	updatedData, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("read updated config file: %v", err)
	}
	updated := string(updatedData)
	if strings.Contains(updated, original) {
		t.Fatalf("expected config file to be overwritten")
	}
	if !strings.Contains(updated, "captures_dir") {
		t.Fatalf("expected overwritten config to contain default template")
	}
}

func assertContainsAll(t *testing.T, content string, values ...string) {
	t.Helper()
	for _, value := range values {
		if !strings.Contains(content, value) {
			t.Fatalf("expected content to include %q, got %q", value, content)
		}
	}
}
