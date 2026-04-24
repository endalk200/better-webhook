package version

import "testing"

func TestNormalizeArch(t *testing.T) {
	if got := normalizeArch("amd64"); got != "x64" {
		t.Fatalf("expected amd64 to normalize to x64, got %q", got)
	}

	if got := normalizeArch("arm64"); got != "arm64" {
		t.Fatalf("expected arm64 to remain unchanged, got %q", got)
	}
}

func TestPlatformFor(t *testing.T) {
	if got := platformFor("linux", "amd64"); got != "linux-x64" {
		t.Fatalf("expected linux-x64, got %q", got)
	}

	if got := platformFor("darwin", "arm64"); got != "darwin-arm64" {
		t.Fatalf("expected darwin-arm64, got %q", got)
	}
}
