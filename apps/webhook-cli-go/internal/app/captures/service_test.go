package captures

import (
	"context"
	"testing"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

func TestListFiltersByProvider(t *testing.T) {
	service := NewService(&capturesRepoStub{
		captures: []domain.CaptureFile{
			{Capture: domain.CaptureRecord{Provider: domain.ProviderGitHub}},
			{Capture: domain.CaptureRecord{Provider: domain.ProviderUnknown}},
		},
	})

	items, err := service.List(context.Background(), ListRequest{
		Limit:    10,
		Provider: domain.ProviderGitHub,
	})
	if err != nil {
		t.Fatalf("list captures: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one provider-filtered item, got %d", len(items))
	}
}

type capturesRepoStub struct {
	captures []domain.CaptureFile
}

func (s *capturesRepoStub) List(context.Context, int) ([]domain.CaptureFile, error) {
	return s.captures, nil
}

func (s *capturesRepoStub) ResolveByIDOrPrefix(context.Context, string) (domain.CaptureFile, error) {
	return domain.CaptureFile{}, nil
}

func (s *capturesRepoStub) DeleteByIDOrPrefix(context.Context, string) (domain.CaptureFile, error) {
	return domain.CaptureFile{}, nil
}
