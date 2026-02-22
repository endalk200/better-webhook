package templates

import (
	"testing"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

func TestGroupRemoteTemplatesByProvider(t *testing.T) {
	grouped := groupRemoteTemplatesByProvider([]domain.RemoteTemplate{
		{Metadata: domain.TemplateMetadata{ID: "a", Provider: "github"}},
		{Metadata: domain.TemplateMetadata{ID: "b", Provider: "github"}},
		{Metadata: domain.TemplateMetadata{ID: "c", Provider: "ragie"}},
	})
	if len(grouped["github"]) != 2 {
		t.Fatalf("expected 2 github templates")
	}
	if len(grouped["ragie"]) != 1 {
		t.Fatalf("expected 1 ragie template")
	}
}

func TestListCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newListCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected list command to reject positional args")
	}
}
