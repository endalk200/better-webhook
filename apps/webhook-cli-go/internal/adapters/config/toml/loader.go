package toml

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/runtime"
	pelletiertoml "github.com/pelletier/go-toml/v2"
)

const envPrefix = "BETTER_WEBHOOK"

type fileConfig struct {
	CapturesDir  *string `toml:"captures_dir"`
	TemplatesDir *string `toml:"templates_dir"`
	LogLevel     *string `toml:"log_level"`
}

type Loader struct{}

func NewLoader() Loader {
	return Loader{}
}

func (Loader) Load(configPath string) (runtime.AppConfig, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return runtime.AppConfig{}, fmt.Errorf("resolve home directory: %w", err)
	}

	loadedConfig := runtime.DefaultConfig(homeDir)

	resolvedConfigPath, err := resolveConfigPath(configPath, homeDir)
	if err != nil {
		return runtime.AppConfig{}, err
	}
	tomlConfig, err := readTOMLConfig(resolvedConfigPath)
	if err != nil {
		return runtime.AppConfig{}, err
	}
	if tomlConfig.CapturesDir != nil {
		loadedConfig.CapturesDir = *tomlConfig.CapturesDir
	}
	if tomlConfig.TemplatesDir != nil {
		loadedConfig.TemplatesDir = *tomlConfig.TemplatesDir
	}
	if tomlConfig.LogLevel != nil {
		loadedConfig.LogLevel = *tomlConfig.LogLevel
	}

	applyEnvOverrides(&loadedConfig)

	normalized, err := normalizeConfig(loadedConfig, homeDir)
	if err != nil {
		return runtime.AppConfig{}, err
	}
	if err := validate(normalized); err != nil {
		return runtime.AppConfig{}, err
	}

	return normalized, nil
}

func validate(cfg runtime.AppConfig) error {
	if strings.TrimSpace(cfg.CapturesDir) == "" {
		return errors.New("captures_dir cannot be empty")
	}
	if strings.TrimSpace(cfg.TemplatesDir) == "" {
		return errors.New("templates_dir cannot be empty")
	}
	if !runtime.IsValidLogLevel(cfg.LogLevel) {
		return errors.New("log_level must be one of: debug, info, warn, error")
	}
	return nil
}

func resolveConfigPath(configPath string, homeDir string) (string, error) {
	path := strings.TrimSpace(configPath)
	if path == "" {
		path = runtime.DefaultConfigPath(homeDir)
	}
	resolved, err := expandPath(path, homeDir)
	if err != nil {
		return "", fmt.Errorf("resolve config path %q: %w", path, err)
	}
	return resolved, nil
}

func readTOMLConfig(path string) (fileConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fileConfig{}, nil
		}
		return fileConfig{}, fmt.Errorf("read config file %q: %w", path, err)
	}

	if err := validateTopLevelKeys(data, path); err != nil {
		return fileConfig{}, err
	}

	parsed := fileConfig{}
	if err := pelletiertoml.Unmarshal(data, &parsed); err != nil {
		return fileConfig{}, fmt.Errorf("parse TOML config %q: %w", path, err)
	}

	return parsed, nil
}

func validateTopLevelKeys(content []byte, path string) error {
	parsed := map[string]any{}
	if err := pelletiertoml.Unmarshal(content, &parsed); err != nil {
		return fmt.Errorf("parse TOML config %q: %w", path, err)
	}
	for key := range parsed {
		switch key {
		case "captures_dir", "templates_dir", "log_level":
			continue
		default:
			return fmt.Errorf("unsupported config key %q in %q", key, path)
		}
	}
	return nil
}

func normalizeConfig(cfg runtime.AppConfig, homeDir string) (runtime.AppConfig, error) {
	cfg.CapturesDir = strings.TrimSpace(cfg.CapturesDir)
	cfg.LogLevel = strings.ToLower(strings.TrimSpace(cfg.LogLevel))

	expandedCapturesDir, err := expandPath(cfg.CapturesDir, homeDir)
	if err != nil {
		return runtime.AppConfig{}, fmt.Errorf("expand captures_dir: %w", err)
	}
	cfg.CapturesDir = expandedCapturesDir
	expandedTemplatesDir, err := expandPath(cfg.TemplatesDir, homeDir)
	if err != nil {
		return runtime.AppConfig{}, fmt.Errorf("expand templates_dir: %w", err)
	}
	cfg.TemplatesDir = expandedTemplatesDir

	return cfg, nil
}

func applyEnvOverrides(cfg *runtime.AppConfig) {
	if cfg == nil {
		return
	}
	if capturesDir, ok := os.LookupEnv(envPrefix + "_CAPTURES_DIR"); ok {
		cfg.CapturesDir = capturesDir
	}
	if templatesDir, ok := os.LookupEnv(envPrefix + "_TEMPLATES_DIR"); ok {
		cfg.TemplatesDir = templatesDir
	}
	if logLevel, ok := os.LookupEnv(envPrefix + "_LOG_LEVEL"); ok {
		cfg.LogLevel = logLevel
	}
}

func expandPath(pathValue, homeDir string) (string, error) {
	trimmed := strings.TrimSpace(os.ExpandEnv(pathValue))
	if trimmed == "" {
		return "", errors.New("path cannot be empty")
	}

	if trimmed == "~" {
		if homeDir == "" {
			return "", errors.New("home directory is not available for '~' expansion")
		}
		return homeDir, nil
	}
	if strings.HasPrefix(trimmed, "~/") {
		if homeDir == "" {
			return "", errors.New("home directory is not available for '~' expansion")
		}
		return filepath.Join(homeDir, strings.TrimPrefix(trimmed, "~/")), nil
	}
	if strings.HasPrefix(trimmed, "~") {
		return "", fmt.Errorf("unsupported home expansion in %q", trimmed)
	}
	if filepath.IsAbs(trimmed) {
		return filepath.Clean(trimmed), nil
	}
	return filepath.Abs(trimmed)
}
