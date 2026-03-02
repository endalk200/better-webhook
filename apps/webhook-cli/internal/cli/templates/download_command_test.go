package templates

import (
	"strings"
	"testing"

	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	domain "github.com/endalk200/better-webhook/apps/webhook-cli/internal/domain/template"
)

func TestDownloadCommandArgsRejectTooManyArgs(t *testing.T) {
	cmd := newDownloadCommand(Dependencies{})
	err := cmd.Args(cmd, []string{"a", "b"})
	if err == nil {
		t.Fatalf("expected too many args error")
	}
}

func TestDownloadCommandArgsRequireAllOrTemplateID(t *testing.T) {
	cmd := newDownloadCommand(Dependencies{})
	err := cmd.Args(cmd, []string{})
	if err == nil {
		t.Fatalf("expected required args validation error")
	}
}

func TestDownloadCommandArgsRejectTemplateIDWithAll(t *testing.T) {
	cmd := newDownloadCommand(Dependencies{})
	if err := cmd.Flags().Set("all", "true"); err != nil {
		t.Fatalf("set all flag: %v", err)
	}
	err := cmd.Args(cmd, []string{"github-push"})
	if err == nil {
		t.Fatalf("expected mutual exclusivity validation error")
	}
}

func TestFormatSingleDownloadSummaryIncludesOutcomeMessage(t *testing.T) {
	downloaded := formatSingleDownloadSummary(apptemplates.DownloadResult{
		Template: domain.LocalTemplate{ID: "github-push"},
		Outcome:  apptemplates.DownloadOutcomeDownloaded,
	})
	if !strings.Contains(downloaded, "Downloaded template github-push") {
		t.Fatalf("unexpected downloaded summary: %q", downloaded)
	}

	already := formatSingleDownloadSummary(apptemplates.DownloadResult{
		Template: domain.LocalTemplate{ID: "github-push"},
		Outcome:  apptemplates.DownloadOutcomeAlreadyCurrent,
	})
	if !strings.Contains(already, "already downloaded") {
		t.Fatalf("unexpected already-downloaded summary: %q", already)
	}

	refreshed := formatSingleDownloadSummary(apptemplates.DownloadResult{
		Template: domain.LocalTemplate{ID: "github-push"},
		Outcome:  apptemplates.DownloadOutcomeRefreshed,
	})
	if !strings.Contains(refreshed, "Refreshed template github-push") {
		t.Fatalf("unexpected refreshed summary: %q", refreshed)
	}
}

func TestFormatAllTemplatesAlreadyDownloadedMessage(t *testing.T) {
	message := formatAllTemplatesAlreadyDownloadedMessage()
	if !strings.Contains(message, "All templates already downloaded.") {
		t.Fatalf("unexpected message: %q", message)
	}
}
