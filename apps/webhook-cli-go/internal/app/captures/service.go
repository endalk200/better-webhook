package captures

import (
	"context"
	"strings"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

type Service struct {
	repo CaptureRepository
}

type ListRequest struct {
	Limit    int
	Provider string
}

func NewService(repo CaptureRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, request ListRequest) ([]domain.CaptureFile, error) {
	captures, err := s.repo.List(ctx, request.Limit)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(request.Provider) == "" {
		return captures, nil
	}

	filtered := make([]domain.CaptureFile, 0, len(captures))
	for _, item := range captures {
		provider := item.Capture.Provider
		if provider == "" {
			provider = domain.ProviderUnknown
		}
		if !strings.EqualFold(provider, request.Provider) {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered, nil
}

func (s *Service) Resolve(ctx context.Context, selector string) (domain.CaptureFile, error) {
	return s.repo.ResolveByIDOrPrefix(ctx, selector)
}

func (s *Service) Delete(ctx context.Context, selector string) (domain.CaptureFile, error) {
	return s.repo.DeleteByIDOrPrefix(ctx, selector)
}
