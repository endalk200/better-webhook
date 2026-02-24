package captures

import (
	"context"
	"testing"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/capture"
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

func TestDeleteResolvedDeletesByFile(t *testing.T) {
	repo := &capturesRepoStub{}
	service := NewService(repo)
	target := domain.CaptureFile{
		File: "2026-02-21T12-00-00.000000000Z_deadbeef.jsonc",
		Capture: domain.CaptureRecord{
			ID: "deadbeef-0000-0000-0000-000000000000",
		},
	}

	deleted, err := service.DeleteResolved(context.Background(), target)
	if err != nil {
		t.Fatalf("delete resolved capture: %v", err)
	}
	if repo.deletedFile != target.File {
		t.Fatalf("expected repository delete file %q, got %q", target.File, repo.deletedFile)
	}
	if deleted.File != target.File {
		t.Fatalf("expected deleted capture file %q, got %q", target.File, deleted.File)
	}
}

func TestNewServicePanicsWhenRepoNil(t *testing.T) {
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatalf("expected panic when repo is nil")
		}
	}()
	_ = NewService(nil)
}

type capturesRepoStub struct {
	captures    []domain.CaptureFile
	deletedFile string
	deleteErr   error
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

func (s *capturesRepoStub) DeleteByFile(_ context.Context, file string) error {
	s.deletedFile = file
	return s.deleteErr
}
