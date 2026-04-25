package toml

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
)

const defaultConfigFileMode = 0o600

type Writer struct{}

func NewWriter() Writer {
	return Writer{}
}

func (Writer) WriteDefaultConfig(configPath string, overwrite bool) (runtime.ConfigWriteResult, error) {
	trimmedPath := strings.TrimSpace(configPath)
	if trimmedPath == "" {
		return runtime.ConfigWriteResult{}, errors.New("config path cannot be empty")
	}

	existed, err := configFileExists(trimmedPath)
	if err != nil {
		return runtime.ConfigWriteResult{}, err
	}
	if existed && !overwrite {
		return runtime.ConfigWriteResult{}, fmt.Errorf("%w: %s", runtime.ErrConfigFileAlreadyExists, trimmedPath)
	}

	if err := os.MkdirAll(filepath.Dir(trimmedPath), 0o755); err != nil {
		return runtime.ConfigWriteResult{}, fmt.Errorf("create config directory for %q: %w", trimmedPath, err)
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return runtime.ConfigWriteResult{}, fmt.Errorf("resolve home directory: %w", err)
	}
	content := renderDefaultConfigTemplate(runtime.DefaultConfig(homeDir))
	if err := os.WriteFile(trimmedPath, []byte(content), defaultConfigFileMode); err != nil {
		return runtime.ConfigWriteResult{}, fmt.Errorf("write config file %q: %w", trimmedPath, err)
	}
	return runtime.ConfigWriteResult{
		Path:        trimmedPath,
		Created:     !existed,
		Overwritten: existed,
	}, nil
}

func configFileExists(path string) (bool, error) {
	info, err := os.Stat(path)
	if err == nil {
		if info.IsDir() {
			return false, fmt.Errorf("config path %q points to a directory", path)
		}
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	return false, fmt.Errorf("inspect config path %q: %w", path, err)
}

func renderDefaultConfigTemplate(defaults runtime.AppConfig) string {
	capturesDir := filepath.ToSlash(defaults.CapturesDir)
	templatesDir := filepath.ToSlash(defaults.TemplatesDir)
	return fmt.Sprintf(`# Better Webhook CLI configuration
#
# This file is optional. The CLI works without it, but keeping defaults here
# makes local development setup explicit and easier to share.
#
# Config file path precedence:
#   1) --config <path>
#   2) %s
#   3) ~/.better-webhook/config.toml
#
# Value precedence for each setting:
#   command flag > environment variable > this file > built-in default
#
# Path values support:
#   - "~" home expansion
#   - "$ENV_VAR" expansion
#   - relative paths (resolved against the current working directory)

# Directory where captured webhook payloads are persisted.
# Override with:
#   - --captures-dir
#   - BETTER_WEBHOOK_CAPTURES_DIR
captures_dir = %q

# Directory for downloaded template files and cache data.
# Override with:
#   - --templates-dir
#   - BETTER_WEBHOOK_TEMPLATES_DIR
templates_dir = %q

# Log level controls default verbosity for commands.
# Supported values: "debug", "info", "warn", "error"
# When set to "debug", verbose output is enabled by default for:
#   - capture
#   - captures replay
#   - templates run
# (You can still explicitly override with --verbose=true/false.)
# Override with:
#   - BETTER_WEBHOOK_LOG_LEVEL
#   - command flags like --verbose on supported commands
log_level = %q
`, runtime.EnvConfigPath, capturesDir, templatesDir, defaults.LogLevel)
}
