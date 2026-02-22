package templates

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
	platformtime "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/time"
)

const defaultIndexCacheTTL = time.Hour

type Service struct {
	localStore  LocalTemplateStore
	remoteStore RemoteTemplateSource
	cacheStore  IndexCacheStore
	clock       platformtime.Clock
	cacheTTL    time.Duration
}

func NewService(
	localStore LocalTemplateStore,
	remoteStore RemoteTemplateSource,
	cacheStore IndexCacheStore,
	clock platformtime.Clock,
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
	return &Service{
		localStore:  localStore,
		remoteStore: remoteStore,
		cacheStore:  cacheStore,
		clock:       clock,
		cacheTTL:    defaultIndexCacheTTL,
	}
}

func (s *Service) ListRemote(ctx context.Context, provider string, forceRefresh bool) ([]domain.RemoteTemplate, error) {
	index, err := s.loadIndex(ctx, forceRefresh)
	if err != nil {
		return nil, err
	}
	locals, err := s.localStore.List(ctx)
	if err != nil {
		return nil, err
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
	remoteItems, err := s.ListRemote(ctx, provider, forceRefresh)
	if err != nil {
		return SearchResult{}, err
	}
	localItems, err := s.ListLocal(ctx, provider)
	if err != nil {
		return SearchResult{}, err
	}
	matches := func(metadata domain.TemplateMetadata) bool {
		queryLower := strings.ToLower(trimmedQuery)
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

func (s *Service) CleanLocal(ctx context.Context) (int, error) {
	return s.localStore.DeleteAll(ctx)
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
		_ = s.cacheStore.Set(ctx, CachedIndex{
			Index:    index,
			CachedAt: s.clock.Now().UTC(),
		})
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

func IsTemplateNotFoundError(err error) bool {
	return errors.Is(err, domain.ErrTemplateNotFound)
}
