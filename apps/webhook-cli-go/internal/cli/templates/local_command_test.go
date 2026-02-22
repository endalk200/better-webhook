package templates

import (
	"testing"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/template"
)

func TestGroupLocalTemplatesByProvider(t *testing.T) {
	grouped := groupLocalTemplatesByProvider([]domain.LocalTemplate{
		{ID: "a", Metadata: domain.TemplateMetadata{Provider: "github"}},
		{ID: "b", Metadata: domain.TemplateMetadata{Provider: "github"}},
		{ID: "c", Metadata: domain.TemplateMetadata{Provider: "ragie"}},
	})
	if len(grouped["github"]) != 2 {
		t.Fatalf("expected 2 github templates")
	}
	if len(grouped["ragie"]) != 1 {
		t.Fatalf("expected 1 ragie template")
	}
}

func TestLocalCommandRejectsUnexpectedArgs(t *testing.T) {
	cmd := newLocalCommand(Dependencies{})
	if err := cmd.Args(cmd, []string{"unexpected"}); err == nil {
		t.Fatalf("expected local command to reject positional args")
	}
}
