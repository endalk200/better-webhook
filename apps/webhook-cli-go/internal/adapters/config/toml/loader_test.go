package toml

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
)

func TestLoadConfigSupportsTOMLAndEnvPrecedenceWithLogLevelNormalization(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	configTOML := `
captures_dir = "~/captures-from-config"
log_level = "warn"
`
	if err := os.WriteFile(configPath, []byte(configTOML), 0o600); err != nil {
		t.Fatalf("write config file: %v", err)
	}

	envCapturesDir := filepath.Join(tempDir, "captures-from-env")
	t.Setenv("BETTER_WEBHOOK_CAPTURES_DIR", envCapturesDir)
	t.Setenv("BETTER_WEBHOOK_LOG_LEVEL", "DEBUG")

	cfg, err := NewLoader().Load(configPath)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if cfg.CapturesDir != envCapturesDir {
		t.Fatalf("captures dir mismatch: got %q want %q", cfg.CapturesDir, envCapturesDir)
	}
	if cfg.LogLevel != runtime.LogLevelDebug {
		t.Fatalf("log level mismatch: got %q want %q", cfg.LogLevel, runtime.LogLevelDebug)
	}
}

func TestLoadConfigExpandsEnvCapturesDir(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	if err := os.WriteFile(configPath, []byte(`captures_dir = "$BW_CAPTURE_DIR"`), 0o600); err != nil {
		t.Fatalf("write config file: %v", err)
	}
	expandedDir := filepath.Join(tempDir, "captures")
	t.Setenv("BW_CAPTURE_DIR", expandedDir)

	cfg, err := NewLoader().Load(configPath)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.CapturesDir != expandedDir {
		t.Fatalf("captures dir mismatch: got %q want %q", cfg.CapturesDir, expandedDir)
	}
}

func TestLoadConfigRejectsUnsupportedKey(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")
	if err := os.WriteFile(configPath, []byte(`capture_port = 3001`), 0o600); err != nil {
		t.Fatalf("write config file: %v", err)
	}

	_, err := NewLoader().Load(configPath)
	if err == nil {
		t.Fatalf("expected unsupported key error")
	}
	if !strings.Contains(err.Error(), "unsupported config key") {
		t.Fatalf("expected unsupported key error message, got %v", err)
	}
}

func TestLoadConfigHandlesMissingConfigFile(t *testing.T) {
	missingPath := filepath.Join(t.TempDir(), "missing.toml")

	cfg, err := NewLoader().Load(missingPath)
	if err != nil {
		t.Fatalf("load config with missing file should not fail: %v", err)
	}
	if strings.TrimSpace(cfg.CapturesDir) == "" {
		t.Fatalf("expected default captures directory to be populated")
	}
}

func TestLoadConfigRejectsInvalidLogLevel(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.toml")
	if err := os.WriteFile(configPath, []byte(`log_level = "trace"`), 0o600); err != nil {
		t.Fatalf("write config file: %v", err)
	}

	_, err := NewLoader().Load(configPath)
	if err == nil {
		t.Fatalf("expected invalid log level error")
	}
	if !strings.Contains(err.Error(), "log_level") {
		t.Fatalf("expected log level validation error, got %v", err)
	}
}
