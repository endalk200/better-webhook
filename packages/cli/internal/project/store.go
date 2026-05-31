package project

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

type Resolver struct {
	LookupIP func(ctx context.Context, host string) ([]net.IP, error)
}

type Store struct {
	resolver Resolver
}

type ResolvedProject struct {
	Root       string
	ConfigPath string
	Config     domain.ProjectConfig
}

type InitOptions struct {
	Directory     string
	Name          string
	ListenAddress string
	Port          int
	CapturePath   string
	RetentionDays int
	Now           time.Time
}

type EndpointInput struct {
	ID        string
	Mode      domain.EndpointMode
	Provider  string
	TargetURL string
	Route     string
	SecretEnv string
	Now       time.Time
}

var endpointIDPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$`)

func NewStore(resolver Resolver) Store {
	if resolver.LookupIP == nil {
		resolver.LookupIP = func(ctx context.Context, host string) ([]net.IP, error) {
			return net.DefaultResolver.LookupIP(ctx, "ip", host)
		}
	}

	return Store{resolver: resolver}
}

func (s Store) Init(options InitOptions) (ResolvedProject, error) {
	if options.Directory == "" {
		options.Directory = "."
	}
	root, err := filepath.Abs(options.Directory)
	if err != nil {
		return ResolvedProject{}, err
	}

	if options.Name == "" {
		options.Name = filepath.Base(root)
	}
	if options.ListenAddress == "" {
		options.ListenAddress = "127.0.0.1"
	}
	if options.Port == 0 {
		options.Port = 4242
	}
	if options.RetentionDays == 0 {
		options.RetentionDays = 7
	}
	if options.Now.IsZero() {
		options.Now = time.Now()
	}

	cfg := domain.ProjectConfig{
		SchemaVersion: domain.SchemaVersion,
		Name:          options.Name,
		Gateway: domain.GatewayConfig{
			ListenAddress: options.ListenAddress,
			Port:          options.Port,
		},
		Capture: domain.CaptureConfig{
			StorePath:     options.CapturePath,
			RetentionDays: options.RetentionDays,
		},
		Endpoints:            []domain.EndpointProfile{},
		TemplateRunHistory:   []domain.TemplateRun{},
		LastTemplateRunPrune: domain.NowString(options.Now),
	}

	if err := ValidateConfig(context.Background(), s.resolver, cfg); err != nil {
		return ResolvedProject{}, err
	}

	resolved := ResolvedProject{
		Root:       root,
		ConfigPath: filepath.Join(root, domain.ConfigDirName, domain.ProjectConfigName),
		Config:     cfg,
	}
	if _, err := os.Stat(resolved.ConfigPath); err == nil {
		return ResolvedProject{}, fmt.Errorf("project already exists at %s", resolved.ConfigPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return ResolvedProject{}, err
	}

	if err := s.Save(resolved); err != nil {
		return ResolvedProject{}, err
	}
	return resolved, nil
}

func (s Store) Save(resolved ResolvedProject) error {
	if err := ValidateConfig(context.Background(), s.resolver, resolved.Config); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(resolved.ConfigPath), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(resolved.Config, "", "\t")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(resolved.ConfigPath, data, 0o600)
}

func (s Store) LoadFromPath(path string) (ResolvedProject, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return ResolvedProject{}, err
	}

	info, err := os.Stat(abs)
	if err != nil {
		return ResolvedProject{}, err
	}

	configPath := abs
	root := filepath.Dir(filepath.Dir(abs))
	if info.IsDir() {
		root = abs
		configPath = filepath.Join(abs, domain.ConfigDirName, domain.ProjectConfigName)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return ResolvedProject{}, err
	}

	var cfg domain.ProjectConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return ResolvedProject{}, fmt.Errorf("invalid project config %s: %w", configPath, err)
	}
	if err := ValidateConfig(context.Background(), s.resolver, cfg); err != nil {
		return ResolvedProject{}, fmt.Errorf("invalid project config %s: %w", configPath, err)
	}

	return ResolvedProject{Root: root, ConfigPath: configPath, Config: cfg}, nil
}

func (s Store) Resolve(start, override string) (ResolvedProject, error) {
	if override != "" {
		return s.LoadFromPath(override)
	}
	if start == "" {
		start = "."
	}
	dir, err := filepath.Abs(start)
	if err != nil {
		return ResolvedProject{}, err
	}
	info, err := os.Stat(dir)
	if err != nil {
		return ResolvedProject{}, err
	}
	if !info.IsDir() {
		dir = filepath.Dir(dir)
	}

	for {
		configPath := filepath.Join(dir, domain.ConfigDirName, domain.ProjectConfigName)
		if _, err := os.Stat(configPath); err == nil {
			return s.LoadFromPath(configPath)
		} else if !errors.Is(err, os.ErrNotExist) {
			return ResolvedProject{}, err
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return ResolvedProject{}, fmt.Errorf("no better-webhook project found from %s; run bw init or pass --project", start)
}

func (s Store) UpsertEndpoint(resolved ResolvedProject, input EndpointInput) (ResolvedProject, domain.EndpointProfile, bool, error) {
	endpoint, err := BuildEndpoint(context.Background(), s.resolver, input)
	if err != nil {
		return ResolvedProject{}, domain.EndpointProfile{}, false, err
	}

	updated := false
	for i, current := range resolved.Config.Endpoints {
		if current.ID == endpoint.ID {
			endpoint.CreatedAt = current.CreatedAt
			resolved.Config.Endpoints[i] = endpoint
			updated = true
			break
		}
	}
	if !updated {
		resolved.Config.Endpoints = append(resolved.Config.Endpoints, endpoint)
	}
	if err := s.Save(resolved); err != nil {
		return ResolvedProject{}, domain.EndpointProfile{}, false, err
	}
	return resolved, endpoint, updated, nil
}

func (s Store) DeleteEndpoint(resolved ResolvedProject, endpointID string) (ResolvedProject, domain.EndpointProfile, error) {
	for i, endpoint := range resolved.Config.Endpoints {
		if endpoint.ID == endpointID {
			resolved.Config.Endpoints = slices.Delete(resolved.Config.Endpoints, i, i+1)
			if err := s.Save(resolved); err != nil {
				return ResolvedProject{}, domain.EndpointProfile{}, err
			}
			return resolved, endpoint, nil
		}
	}

	return ResolvedProject{}, domain.EndpointProfile{}, fmt.Errorf("endpoint %q not found", endpointID)
}

func EndpointByID(cfg domain.ProjectConfig, endpointID string) (domain.EndpointProfile, bool) {
	for _, endpoint := range cfg.Endpoints {
		if endpoint.ID == endpointID {
			return endpoint, true
		}
	}
	return domain.EndpointProfile{}, false
}

func BuildEndpoint(ctx context.Context, resolver Resolver, input EndpointInput) (domain.EndpointProfile, error) {
	if input.Now.IsZero() {
		input.Now = time.Now()
	}
	route, err := NormalizeRoute(input.Route)
	if err != nil {
		return domain.EndpointProfile{}, err
	}
	if err := validateEndpointID(input.ID); err != nil {
		return domain.EndpointProfile{}, err
	}
	if input.Mode == "" {
		input.Mode = domain.EndpointModeGeneric
	}
	if input.Mode != domain.EndpointModeGeneric && input.Mode != domain.EndpointModeProvider {
		return domain.EndpointProfile{}, fmt.Errorf("unsupported endpoint mode %q", input.Mode)
	}
	provider := strings.ToLower(strings.TrimSpace(input.Provider))
	if input.Mode == domain.EndpointModeProvider {
		if provider == "" {
			return domain.EndpointProfile{}, errors.New("provider-aware endpoints require --provider")
		}
		if input.SecretEnv == "" {
			return domain.EndpointProfile{}, errors.New("provider-aware endpoints require --secret-env; plaintext secrets are not stored in project config")
		}
	} else if provider != "" {
		return domain.EndpointProfile{}, errors.New("generic endpoints cannot set --provider; use --mode provider")
	}

	target, err := NormalizeAndValidateTarget(ctx, resolver, input.TargetURL)
	if err != nil {
		return domain.EndpointProfile{}, err
	}

	now := domain.NowString(input.Now)
	return domain.EndpointProfile{
		ID:        input.ID,
		Mode:      input.Mode,
		Provider:  provider,
		TargetURL: target,
		Route:     route,
		Secret: domain.ProviderSecret{
			Env: input.SecretEnv,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func ValidateConfig(ctx context.Context, resolver Resolver, cfg domain.ProjectConfig) error {
	if cfg.SchemaVersion == "" {
		return errors.New("schemaVersion is required")
	}
	if cfg.SchemaVersion != domain.SchemaVersion {
		return fmt.Errorf("unsupported project schemaVersion %q", cfg.SchemaVersion)
	}
	if strings.TrimSpace(cfg.Name) == "" {
		return errors.New("project name is required")
	}
	if cfg.Gateway.ListenAddress == "" {
		return errors.New("gateway.listenAddress is required")
	}
	if cfg.Gateway.Port < 0 || cfg.Gateway.Port > 65535 {
		return fmt.Errorf("gateway.port must be between 0 and 65535")
	}
	if cfg.Capture.RetentionDays <= 0 {
		return errors.New("capture.retentionDays must be greater than zero")
	}

	ids := map[string]struct{}{}
	routes := map[string]struct{}{}
	for i, endpoint := range cfg.Endpoints {
		if err := validateEndpointID(endpoint.ID); err != nil {
			return fmt.Errorf("endpoints[%d]: %w", i, err)
		}
		if _, exists := ids[endpoint.ID]; exists {
			return fmt.Errorf("duplicate endpoint id %q", endpoint.ID)
		}
		ids[endpoint.ID] = struct{}{}

		route, err := NormalizeRoute(endpoint.Route)
		if err != nil {
			return fmt.Errorf("endpoint %q: %w", endpoint.ID, err)
		}
		if route != endpoint.Route {
			return fmt.Errorf("endpoint %q route must be normalized as %q", endpoint.ID, route)
		}
		if _, exists := routes[route]; exists {
			return fmt.Errorf("duplicate endpoint route %q", route)
		}
		routes[route] = struct{}{}

		if _, err := NormalizeAndValidateTarget(ctx, resolver, endpoint.TargetURL); err != nil {
			return fmt.Errorf("endpoint %q target is unsafe: %w", endpoint.ID, err)
		}
		if endpoint.Mode != domain.EndpointModeGeneric && endpoint.Mode != domain.EndpointModeProvider {
			return fmt.Errorf("endpoint %q has unsupported mode %q", endpoint.ID, endpoint.Mode)
		}
		if endpoint.Mode == domain.EndpointModeProvider {
			if endpoint.Provider == "" {
				return fmt.Errorf("endpoint %q provider is required", endpoint.ID)
			}
			if endpoint.Secret.Env == "" {
				return fmt.Errorf("endpoint %q secret.env is required", endpoint.ID)
			}
		}
	}

	return nil
}

func NormalizeRoute(route string) (string, error) {
	route = strings.TrimSpace(route)
	if route == "" {
		return "", errors.New("route is required and must be explicit")
	}
	if !strings.HasPrefix(route, "/") {
		return "", fmt.Errorf("route %q must start with /", route)
	}
	if strings.Contains(route, "?") || strings.Contains(route, "#") {
		return "", fmt.Errorf("route %q must not include query strings or fragments", route)
	}
	for len(route) > 1 && strings.HasSuffix(route, "/") {
		route = strings.TrimSuffix(route, "/")
	}
	return route, nil
}

func NormalizeAndValidateTarget(ctx context.Context, resolver Resolver, raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("target URL is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("invalid target URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("target URL must use http or https")
	}
	if parsed.User != nil {
		return "", errors.New("target URL must not contain credentials")
	}
	host := parsed.Hostname()
	if host == "" {
		return "", errors.New("target URL host is required")
	}
	if parsed.Fragment != "" {
		return "", errors.New("target URL must not contain a fragment")
	}

	allowed, reason := isAllowedHost(ctx, resolver, host)
	if !allowed {
		return "", fmt.Errorf("%s; only localhost, loopback, and private LAN targets are allowed", reason)
	}

	parsed.Host = strings.ToLower(parsed.Host)
	return parsed.String(), nil
}

func validateEndpointID(id string) error {
	if !endpointIDPattern.MatchString(id) {
		return fmt.Errorf("endpoint id %q must be 1-80 characters and contain only letters, numbers, dots, underscores, or hyphens", id)
	}
	return nil
}

func isAllowedHost(ctx context.Context, resolver Resolver, host string) (bool, string) {
	normalized := strings.Trim(host, "[]")
	if strings.EqualFold(normalized, "localhost") {
		return true, ""
	}
	if ip := net.ParseIP(normalized); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
			return true, ""
		}
		return false, fmt.Sprintf("target host %q resolves to public IP %s", host, ip.String())
	}
	if strings.EqualFold(normalized, "host.docker.internal") {
		return true, ""
	}
	if strings.HasSuffix(strings.ToLower(normalized), ".local") {
		return true, ""
	}

	ips, err := resolver.LookupIP(ctx, normalized)
	if err != nil {
		return false, fmt.Sprintf("target hostname %q could not be resolved", host)
	}
	if len(ips) == 0 {
		return false, fmt.Sprintf("target hostname %q resolved to no addresses", host)
	}
	for _, ip := range ips {
		if !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsLinkLocalUnicast() {
			return false, fmt.Sprintf("target hostname %q resolves to public IP %s", host, ip.String())
		}
	}
	return true, ""
}
