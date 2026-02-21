package runtime

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const (
	LogLevelDebug = "debug"
	LogLevelInfo  = "info"
	LogLevelWarn  = "warn"
	LogLevelError = "error"
)

const (
	DefaultCaptureHost          = "127.0.0.1"
	DefaultCapturePort          = 3001
	DefaultCaptureVerbose       = false
	DefaultReplayBaseURL        = "http://localhost:3000"
	DefaultReplayTimeout        = 30 * time.Second
	DefaultLogLevel             = LogLevelInfo
	defaultConfigRelativePath   = ".better-webhook/config.toml"
	defaultCapturesRelativePath = ".better-webhook/captures"
)

type AppConfig struct {
	CapturesDir string
	LogLevel    string
}

type Loader interface {
	Load(configPath string) (AppConfig, error)
}

type runtimeConfigContextKey struct{}

type CaptureArgs struct {
	CapturesDir string
	Host        string
	Port        int
	Verbose     bool
}

type CapturesListArgs struct {
	CapturesDir string
	Limit       int
	Provider    string
}

type CapturesDeleteArgs struct {
	CapturesDir string
	Selector    string
	Force       bool
}

type ReplayHeaderOverride struct {
	Key   string
	Value string
}

type ReplayArgs struct {
	CapturesDir     string
	Selector        string
	TargetURL       string
	BaseURL         string
	Method          string
	HeaderOverrides []ReplayHeaderOverride
	Timeout         time.Duration
	Verbose         bool
}

func DefaultConfigPath(homeDir string) string {
	return filepath.Join(homeDir, defaultConfigRelativePath)
}

func DefaultConfig(homeDir string) AppConfig {
	return AppConfig{
		CapturesDir: filepath.Join(homeDir, defaultCapturesRelativePath),
		LogLevel:    DefaultLogLevel,
	}
}

func InitializeConfig(cmd *cobra.Command, loader Loader) error {
	if loader == nil {
		return errors.New("config loader cannot be nil")
	}
	configPath, err := ResolveConfigPathFlag(cmd)
	if err != nil {
		return err
	}
	loadedConfig, err := loader.Load(configPath)
	if err != nil {
		return err
	}

	baseCtx := cmd.Context()
	if baseCtx == nil {
		baseCtx = context.Background()
	}
	cmd.SetContext(context.WithValue(baseCtx, runtimeConfigContextKey{}, loadedConfig))
	return nil
}

func RuntimeConfigFromCommand(cmd *cobra.Command) (AppConfig, error) {
	if cmd == nil {
		return AppConfig{}, errors.New("command cannot be nil")
	}
	if cmd.Context() == nil {
		return AppConfig{}, errors.New("runtime config is not initialized")
	}
	loadedConfig, ok := cmd.Context().Value(runtimeConfigContextKey{}).(AppConfig)
	if !ok {
		return AppConfig{}, errors.New("runtime config is not initialized")
	}
	return loadedConfig, nil
}

// ResolveConfigPathFlag returns the config flag value when present.
// If no config flag exists on the command, it returns an empty string and nil.
// Callers should treat an empty value as "use default config path".
func ResolveConfigPathFlag(cmd *cobra.Command) (string, error) {
	if cmd == nil {
		return "", errors.New("command cannot be nil")
	}
	flag := cmd.Flags().Lookup("config")
	if flag == nil {
		flag = cmd.InheritedFlags().Lookup("config")
	}
	if flag == nil {
		return "", nil
	}
	return flag.Value.String(), nil
}

func ResolveCaptureArgs(cmd *cobra.Command) (CaptureArgs, error) {
	loadedConfig, err := RuntimeConfigFromCommand(cmd)
	if err != nil {
		return CaptureArgs{}, err
	}

	capturesDir, err := resolveCapturesDir(cmd, loadedConfig.CapturesDir)
	if err != nil {
		return CaptureArgs{}, err
	}
	host, err := cmd.Flags().GetString("host")
	if err != nil {
		return CaptureArgs{}, err
	}
	port, err := cmd.Flags().GetInt("port")
	if err != nil {
		return CaptureArgs{}, err
	}
	verbose, err := resolveCaptureVerbose(cmd, loadedConfig.LogLevel)
	if err != nil {
		return CaptureArgs{}, err
	}

	normalizedHost := strings.TrimSpace(host)
	if normalizedHost == "" {
		return CaptureArgs{}, errors.New("host cannot be empty")
	}
	if port < 0 || port > 65535 {
		return CaptureArgs{}, errors.New("port must be between 0 and 65535")
	}

	return CaptureArgs{
		CapturesDir: capturesDir,
		Host:        normalizedHost,
		Port:        port,
		Verbose:     verbose,
	}, nil
}

func ResolveCapturesListArgs(cmd *cobra.Command) (CapturesListArgs, error) {
	loadedConfig, err := RuntimeConfigFromCommand(cmd)
	if err != nil {
		return CapturesListArgs{}, err
	}
	capturesDir, err := resolveCapturesDir(cmd, loadedConfig.CapturesDir)
	if err != nil {
		return CapturesListArgs{}, err
	}
	limit, err := cmd.Flags().GetInt("limit")
	if err != nil {
		return CapturesListArgs{}, err
	}
	if limit <= 0 {
		return CapturesListArgs{}, errors.New("limit must be a positive integer")
	}
	provider, err := cmd.Flags().GetString("provider")
	if err != nil {
		return CapturesListArgs{}, err
	}
	return CapturesListArgs{
		CapturesDir: capturesDir,
		Limit:       limit,
		Provider:    strings.TrimSpace(provider),
	}, nil
}

func ResolveCapturesDeleteArgs(cmd *cobra.Command, selector string) (CapturesDeleteArgs, error) {
	loadedConfig, err := RuntimeConfigFromCommand(cmd)
	if err != nil {
		return CapturesDeleteArgs{}, err
	}
	capturesDir, err := resolveCapturesDir(cmd, loadedConfig.CapturesDir)
	if err != nil {
		return CapturesDeleteArgs{}, err
	}
	force, err := cmd.Flags().GetBool("force")
	if err != nil {
		return CapturesDeleteArgs{}, err
	}
	trimmedSelector := strings.TrimSpace(selector)
	if trimmedSelector == "" {
		return CapturesDeleteArgs{}, errors.New("capture selector cannot be empty")
	}

	return CapturesDeleteArgs{
		CapturesDir: capturesDir,
		Selector:    trimmedSelector,
		Force:       force,
	}, nil
}

func ResolveReplayArgs(cmd *cobra.Command, args []string) (ReplayArgs, error) {
	loadedConfig, err := RuntimeConfigFromCommand(cmd)
	if err != nil {
		return ReplayArgs{}, err
	}
	capturesDir, err := resolveCapturesDir(cmd, loadedConfig.CapturesDir)
	if err != nil {
		return ReplayArgs{}, err
	}
	if len(args) == 0 {
		return ReplayArgs{}, errors.New("capture selector cannot be empty")
	}
	selector := strings.TrimSpace(args[0])
	if selector == "" {
		return ReplayArgs{}, errors.New("capture selector cannot be empty")
	}

	targetURL := ""
	if len(args) > 1 {
		targetURL = strings.TrimSpace(args[1])
	}

	baseURL, err := cmd.Flags().GetString("base-url")
	if err != nil {
		return ReplayArgs{}, err
	}
	baseURL = strings.TrimSpace(baseURL)
	if targetURL == "" && baseURL == "" {
		return ReplayArgs{}, errors.New("base URL cannot be empty")
	}

	method, err := cmd.Flags().GetString("method")
	if err != nil {
		return ReplayArgs{}, err
	}
	method = strings.ToUpper(strings.TrimSpace(method))
	if method != "" && !isValidHTTPMethod(method) {
		return ReplayArgs{}, errors.New("method contains invalid characters")
	}

	rawHeaders, err := cmd.Flags().GetStringArray("header")
	if err != nil {
		return ReplayArgs{}, err
	}
	headerOverrides, err := parseReplayHeaderOverrides(rawHeaders)
	if err != nil {
		return ReplayArgs{}, err
	}

	timeout, err := cmd.Flags().GetDuration("timeout")
	if err != nil {
		return ReplayArgs{}, err
	}
	if timeout <= 0 {
		return ReplayArgs{}, errors.New("timeout must be greater than 0")
	}

	verbose, err := resolveCaptureVerbose(cmd, loadedConfig.LogLevel)
	if err != nil {
		return ReplayArgs{}, err
	}

	if targetURL != "" {
		if err := validateAbsoluteURL(targetURL); err != nil {
			return ReplayArgs{}, fmt.Errorf("target URL is invalid: %w", err)
		}
	} else {
		if err := validateAbsoluteURL(baseURL); err != nil {
			return ReplayArgs{}, fmt.Errorf("base URL is invalid: %w", err)
		}
	}

	return ReplayArgs{
		CapturesDir:     capturesDir,
		Selector:        selector,
		TargetURL:       targetURL,
		BaseURL:         baseURL,
		Method:          method,
		HeaderOverrides: headerOverrides,
		Timeout:         timeout,
		Verbose:         verbose,
	}, nil
}

func IsValidLogLevel(level string) bool {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case LogLevelDebug, LogLevelInfo, LogLevelWarn, LogLevelError:
		return true
	default:
		return false
	}
}

func ExpandPath(pathValue string) (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	return expandPath(pathValue, homeDir)
}

func resolveCapturesDir(cmd *cobra.Command, fallbackDir string) (string, error) {
	if cmd == nil {
		return "", errors.New("command cannot be nil")
	}
	rawDir := fallbackDir
	flag := cmd.Flags().Lookup("captures-dir")
	if flag != nil && flag.Changed {
		rawDir = flag.Value.String()
	}
	expanded, err := ExpandPath(rawDir)
	if err != nil {
		return "", fmt.Errorf("resolve captures directory: %w", err)
	}
	return expanded, nil
}

func resolveCaptureVerbose(cmd *cobra.Command, logLevel string) (bool, error) {
	flag := cmd.Flags().Lookup("verbose")
	if flag != nil && flag.Changed {
		return cmd.Flags().GetBool("verbose")
	}
	return strings.EqualFold(logLevel, LogLevelDebug), nil
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

func validateAbsoluteURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return errors.New("must include scheme and host")
	}
	return nil
}

func parseReplayHeaderOverrides(raw []string) ([]ReplayHeaderOverride, error) {
	overrides := make([]ReplayHeaderOverride, 0, len(raw))
	for _, entry := range raw {
		trimmed := strings.TrimSpace(entry)
		if trimmed == "" {
			return nil, errors.New("header override cannot be empty")
		}
		parts := strings.SplitN(trimmed, ":", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("header override must use key:value format: %s", trimmed)
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if key == "" || value == "" {
			return nil, fmt.Errorf("header override must include key and value: %s", trimmed)
		}
		overrides = append(overrides, ReplayHeaderOverride{
			Key:   key,
			Value: value,
		})
	}
	return overrides, nil
}

func isValidHTTPMethod(method string) bool {
	if len(method) == 0 {
		return false
	}
	for _, r := range method {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
		isTokenPunctuation := strings.ContainsRune("!#$%&'*+-.^_`|~", r)
		if !isAlphaNum && !isTokenPunctuation {
			return false
		}
	}
	return true
}
