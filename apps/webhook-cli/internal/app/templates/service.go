package templates

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
	platformhttprequest "github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/httprequest"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/httpurl"
	platformplaceholders "github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/placeholders"
	platformtime "github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/time"
)

const defaultIndexCacheTTL = time.Hour

type Service struct {
	localStore  LocalTemplateStore
	remoteStore RemoteTemplateSource
	cacheStore  IndexCacheStore
	dispatcher  Dispatcher
	resolver    *platformplaceholders.Resolver
	clock       platformtime.Clock
	cacheTTL    time.Duration
	envLookupFn func(string) (string, bool)
}

type ServiceOption func(*Service)

func WithDispatcher(dispatcher Dispatcher) ServiceOption {
	return func(service *Service) {
		service.dispatcher = dispatcher
	}
}

func WithPlaceholderResolver(resolver *platformplaceholders.Resolver) ServiceOption {
	return func(service *Service) {
		service.resolver = resolver
	}
}

func WithEnvironmentLookup(lookupFn func(string) (string, bool)) ServiceOption {
	return func(service *Service) {
		service.envLookupFn = lookupFn
	}
}

func NewService(
	localStore LocalTemplateStore,
	remoteStore RemoteTemplateSource,
	cacheStore IndexCacheStore,
	clock platformtime.Clock,
	options ...ServiceOption,
) *Service {
	if localStore == nil {
		panic("local store cannot be nil")
	}
	if remoteStore == nil {
		panic("remote store cannot be nil")
	}
	if cacheStore == nil {
		panic("cache store cannot be nil")
	}
	if clock == nil {
		clock = platformtime.SystemClock{}
	}
	service := &Service{
		localStore:  localStore,
		remoteStore: remoteStore,
		cacheStore:  cacheStore,
		clock:       clock,
		cacheTTL:    defaultIndexCacheTTL,
		envLookupFn: os.LookupEnv,
	}
	for _, option := range options {
		option(service)
	}
	if service.resolver == nil {
		service.resolver = platformplaceholders.NewResolver(service.clock, nil, service.envLookupFn)
	}
	return service
}

func (s *Service) ListRemote(ctx context.Context, provider string, forceRefresh bool) ([]domain.RemoteTemplate, error) {
	return s.listRemote(ctx, provider, forceRefresh, nil)
}

func (s *Service) listRemote(
	ctx context.Context,
	provider string,
	forceRefresh bool,
	locals []domain.LocalTemplate,
) ([]domain.RemoteTemplate, error) {
	index, err := s.loadIndex(ctx, forceRefresh)
	if err != nil {
		return nil, err
	}
	if locals == nil {
		locals, err = s.localStore.List(ctx)
		if err != nil {
			return nil, err
		}
	}
	localByID := make(map[string]bool, len(locals))
	for _, item := range locals {
		localByID[item.ID] = true
	}
	trimmedProvider := strings.TrimSpace(provider)
	remotes := make([]domain.RemoteTemplate, 0, len(index.Templates))
	for _, metadata := range index.Templates {
		if trimmedProvider != "" && !strings.EqualFold(trimmedProvider, metadata.Provider) {
			continue
		}
		remotes = append(remotes, domain.RemoteTemplate{
			Metadata:     metadata,
			IsDownloaded: localByID[metadata.ID],
		})
	}
	return remotes, nil
}

func (s *Service) Download(ctx context.Context, templateID string, forceRefresh bool) (domain.LocalTemplate, error) {
	trimmedID := strings.TrimSpace(templateID)
	if trimmedID == "" {
		return domain.LocalTemplate{}, domain.ErrInvalidTemplateID
	}
	index, err := s.loadIndex(ctx, forceRefresh)
	if err != nil {
		return domain.LocalTemplate{}, err
	}
	var metadata *domain.TemplateMetadata
	for idx := range index.Templates {
		if index.Templates[idx].ID == trimmedID {
			metadata = &index.Templates[idx]
			break
		}
	}
	if metadata == nil {
		return domain.LocalTemplate{}, fmt.Errorf("%w: %s", domain.ErrTemplateNotFound, trimmedID)
	}
	template, err := s.remoteStore.FetchTemplate(ctx, metadata.File)
	if err != nil {
		return domain.LocalTemplate{}, err
	}
	if strings.TrimSpace(template.Provider) == "" {
		template.Provider = metadata.Provider
	}
	if strings.TrimSpace(template.Event) == "" {
		template.Event = metadata.Event
	}
	if strings.TrimSpace(template.Description) == "" {
		template.Description = metadata.Description
	}
	return s.localStore.Save(ctx, *metadata, template, s.clock.Now().UTC().Format(time.RFC3339Nano))
}

func (s *Service) DownloadAll(ctx context.Context, forceRefresh bool) (DownloadAllResult, error) {
	index, err := s.loadIndex(ctx, forceRefresh)
	if err != nil {
		return DownloadAllResult{}, err
	}
	locals, err := s.localStore.List(ctx)
	if err != nil {
		return DownloadAllResult{}, err
	}
	localByID := make(map[string]bool, len(locals))
	for _, item := range locals {
		localByID[item.ID] = true
	}
	result := DownloadAllResult{Total: len(index.Templates)}
	for _, metadata := range index.Templates {
		if localByID[metadata.ID] {
			result.Skipped++
			continue
		}
		template, err := s.remoteStore.FetchTemplate(ctx, metadata.File)
		if err != nil {
			result.Failed++
			result.FailedIDs = append(result.FailedIDs, metadata.ID)
			continue
		}
		if strings.TrimSpace(template.Provider) == "" {
			template.Provider = metadata.Provider
		}
		if strings.TrimSpace(template.Event) == "" {
			template.Event = metadata.Event
		}
		if strings.TrimSpace(template.Description) == "" {
			template.Description = metadata.Description
		}
		if _, err := s.localStore.Save(ctx, metadata, template, s.clock.Now().UTC().Format(time.RFC3339Nano)); err != nil {
			result.Failed++
			result.FailedIDs = append(result.FailedIDs, metadata.ID)
			continue
		}
		result.Downloaded++
	}
	return result, nil
}

func (s *Service) ListLocal(ctx context.Context, provider string) ([]domain.LocalTemplate, error) {
	items, err := s.localStore.List(ctx)
	if err != nil {
		return nil, err
	}
	trimmedProvider := strings.TrimSpace(provider)
	if trimmedProvider == "" {
		return items, nil
	}
	filtered := make([]domain.LocalTemplate, 0, len(items))
	for _, item := range items {
		if strings.EqualFold(item.Metadata.Provider, trimmedProvider) {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *Service) Search(
	ctx context.Context,
	query string,
	provider string,
	forceRefresh bool,
) (SearchResult, error) {
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return SearchResult{}, domain.ErrInvalidTemplateQuery
	}

	allLocalItems, err := s.localStore.List(ctx)
	if err != nil {
		return SearchResult{}, err
	}
	remoteItems, err := s.listRemote(ctx, provider, forceRefresh, allLocalItems)
	if err != nil {
		return SearchResult{}, err
	}
	localItems := allLocalItems
	trimmedProvider := strings.TrimSpace(provider)
	if trimmedProvider != "" {
		filtered := make([]domain.LocalTemplate, 0, len(allLocalItems))
		for _, item := range allLocalItems {
			if strings.EqualFold(item.Metadata.Provider, trimmedProvider) {
				filtered = append(filtered, item)
			}
		}
		localItems = filtered
	}
	queryLower := strings.ToLower(trimmedQuery)
	matches := func(metadata domain.TemplateMetadata) bool {
		return strings.Contains(strings.ToLower(metadata.ID), queryLower) ||
			strings.Contains(strings.ToLower(metadata.Name), queryLower) ||
			strings.Contains(strings.ToLower(metadata.Provider), queryLower) ||
			strings.Contains(strings.ToLower(metadata.Event), queryLower) ||
			strings.Contains(strings.ToLower(metadata.Description), queryLower)
	}
	result := SearchResult{
		Local:  make([]domain.LocalTemplate, 0, len(localItems)),
		Remote: make([]domain.RemoteTemplate, 0, len(remoteItems)),
	}
	for _, item := range localItems {
		if matches(item.Metadata) {
			result.Local = append(result.Local, item)
		}
	}
	for _, item := range remoteItems {
		if matches(item.Metadata) {
			result.Remote = append(result.Remote, item)
		}
	}
	return result, nil
}

func (s *Service) ClearCache(ctx context.Context) error {
	return s.cacheStore.Clear(ctx)
}

func (s *Service) DeleteLocal(ctx context.Context, templateID string) (domain.LocalTemplate, error) {
	trimmedID := strings.TrimSpace(templateID)
	if trimmedID == "" {
		return domain.LocalTemplate{}, domain.ErrInvalidTemplateID
	}
	return s.localStore.Delete(ctx, trimmedID)
}

func (s *Service) CleanLocal(ctx context.Context) (int, error) {
	return s.localStore.DeleteAll(ctx)
}

func (s *Service) Run(ctx context.Context, request RunRequest) (RunResult, error) {
	if s.dispatcher == nil {
		return RunResult{}, ErrRunNotConfigured
	}
	trimmedTemplateID := strings.TrimSpace(request.TemplateID)
	if trimmedTemplateID == "" {
		return RunResult{}, domain.ErrInvalidTemplateID
	}
	if request.Timeout <= 0 {
		return RunResult{}, ErrRunTimeoutInvalid
	}
	localTemplate, err := s.loadLocalTemplate(ctx, trimmedTemplateID)
	if err != nil {
		return RunResult{}, err
	}
	targetURL := strings.TrimSpace(request.TargetURL)
	if targetURL == "" {
		targetURL = strings.TrimSpace(localTemplate.Template.URL)
	}
	if targetURL == "" {
		return RunResult{}, ErrRunTargetURLRequired
	}
	if err := httpurl.ValidateAbsolute(targetURL); err != nil {
		return RunResult{}, fmt.Errorf("%w: %w", ErrRunInvalidTargetURL, err)
	}
	method := strings.ToUpper(strings.TrimSpace(localTemplate.Template.Method))
	if method == "" {
		method = http.MethodPost
	}
	if !platformhttprequest.IsValidHTTPMethod(method) {
		return RunResult{}, ErrRunInvalidMethod
	}

	resolver := s.resolver.WithEnvironmentPlaceholdersEnabled(request.AllowEnvPlaceholders)
	resolvedBody, err := s.resolveBody(localTemplate.Template.Body, resolver)
	if err != nil {
		return RunResult{}, err
	}
	mergedHeaders := toTemplateDomainHeaders(
		platformhttprequest.ApplyHeaderOverrides(
			toRequestHeaders(localTemplate.Template.Headers),
			toRequestHeaders(request.HeaderOverrides),
		),
	)
	provider := strings.TrimSpace(localTemplate.Template.Provider)
	if provider == "" {
		provider = strings.TrimSpace(localTemplate.Metadata.Provider)
	}
	resolvedSecret := s.resolveProviderSecret(provider, request.Secret)
	resolvedHeaders := make([]domain.HeaderEntry, 0, len(mergedHeaders))
	for _, header := range mergedHeaders {
		headerKey := strings.TrimSpace(header.Key)
		if headerKey == "" || platformhttprequest.ShouldSkipHopByHopHeader(headerKey) {
			continue
		}
		resolvedValue, resolveErr := resolver.ResolveHeaderValue(
			headerKey,
			header.Value,
			platformplaceholders.HeaderContext{
				Provider: provider,
				Secret:   resolvedSecret,
				Body:     resolvedBody,
			},
		)
		if resolveErr != nil {
			if errors.Is(resolveErr, platformplaceholders.ErrMissingSecret) {
				return RunResult{}, ErrRunSecretRequired
			}
			return RunResult{}, resolveErr
		}
		resolvedHeaders = append(resolvedHeaders, domain.HeaderEntry{
			Key:   headerKey,
			Value: resolvedValue,
		})
	}

	dispatched, err := s.dispatcher.Dispatch(ctx, DispatchRequest{
		Method:  method,
		URL:     targetURL,
		Headers: resolvedHeaders,
		Body:    resolvedBody,
		Timeout: request.Timeout,
	})
	if err != nil {
		return RunResult{}, err
	}

	return RunResult{
		TemplateID:  localTemplate.ID,
		Provider:    providerOrUnknown(provider),
		Event:       localTemplate.Metadata.Event,
		TargetURL:   targetURL,
		Method:      method,
		SentHeaders: resolvedHeaders,
		Response:    RunResponse(dispatched),
	}, nil
}

func (s *Service) loadIndex(ctx context.Context, forceRefresh bool) (domain.TemplatesIndex, error) {
	if !forceRefresh {
		cached, ok, err := s.cacheStore.Get(ctx)
		if err == nil && ok {
			if s.clock.Now().UTC().Sub(cached.CachedAt.UTC()) < s.cacheTTL {
				return cached.Index, nil
			}
		}
	}

	index, err := s.remoteStore.FetchIndex(ctx)
	if err == nil {
		cachedAt := s.clock.Now().UTC()
		if setErr := s.cacheStore.Set(ctx, CachedIndex{
			Index:    index,
			CachedAt: cachedAt,
		}); setErr != nil {
			slog.Warn(
				"failed to update templates index cache",
				"error",
				setErr,
				"templates_count",
				len(index.Templates),
				"cached_at",
				cachedAt.Format(time.RFC3339Nano),
			)
		}
		return index, nil
	}

	if !forceRefresh {
		cached, ok, cacheErr := s.cacheStore.Get(ctx)
		if cacheErr == nil && ok {
			return cached.Index, nil
		}
	}
	return domain.TemplatesIndex{}, fmt.Errorf("%w: %v", domain.ErrTemplateIndexUnavailable, err)
}

func (s *Service) loadLocalTemplate(ctx context.Context, templateID string) (domain.LocalTemplate, error) {
	return s.localStore.Get(ctx, templateID)
}

func (s *Service) resolveBody(body json.RawMessage, resolver *platformplaceholders.Resolver) ([]byte, error) {
	resolvedBody, err := resolver.ResolveBody(body)
	if err != nil {
		return nil, errors.Join(ErrRunInvalidBody, err)
	}
	return resolvedBody, nil
}

func (s *Service) resolveProviderSecret(provider string, fromRequest string) string {
	trimmedFromRequest := strings.TrimSpace(fromRequest)
	if trimmedFromRequest != "" {
		return trimmedFromRequest
	}
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "github":
		if secret, ok := s.envLookupFn("GITHUB_WEBHOOK_SECRET"); ok && strings.TrimSpace(secret) != "" {
			return strings.TrimSpace(secret)
		}
	}
	if secret, ok := s.envLookupFn("WEBHOOK_SECRET"); ok && strings.TrimSpace(secret) != "" {
		return strings.TrimSpace(secret)
	}
	return ""
}

func providerOrUnknown(provider string) string {
	if strings.TrimSpace(provider) == "" {
		return "unknown"
	}
	return provider
}

func toRequestHeaders(headers []domain.HeaderEntry) []platformhttprequest.HeaderEntry {
	converted := make([]platformhttprequest.HeaderEntry, 0, len(headers))
	for _, header := range headers {
		converted = append(converted, platformhttprequest.HeaderEntry{
			Key:   header.Key,
			Value: header.Value,
		})
	}
	return converted
}

func toTemplateDomainHeaders(headers []platformhttprequest.HeaderEntry) []domain.HeaderEntry {
	converted := make([]domain.HeaderEntry, 0, len(headers))
	for _, header := range headers {
		converted = append(converted, domain.HeaderEntry{
			Key:   header.Key,
			Value: header.Value,
		})
	}
	return converted
}

func IsTemplateNotFoundError(err error) bool {
	return errors.Is(err, domain.ErrTemplateNotFound)
}
