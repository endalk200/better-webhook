package version

import (
	"runtime"
	"strings"
)

const SchemaVersion = 1

var (
	// Version is injected at build time for release binaries.
	Version = "dev"
	// Commit is injected at build time for release binaries.
	Commit = "unknown"
	// Date is injected at build time for release binaries.
	Date = "unknown"
)

type Info struct {
	SchemaVersion int    `json:"schemaVersion"`
	Version       string `json:"version"`
	Commit        string `json:"commit"`
	Date          string `json:"date"`
	Platform      string `json:"platform"`
}

func Current() Info {
	return Info{
		SchemaVersion: SchemaVersion,
		Version:       Version,
		Commit:        Commit,
		Date:          Date,
		Platform:      platformFor(runtime.GOOS, runtime.GOARCH),
	}
}

func platformFor(goos, goarch string) string {
	return goos + "-" + normalizeArch(goarch)
}

func normalizeArch(goarch string) string {
	if goarch == "amd64" {
		return "x64"
	}

	return strings.TrimSpace(goarch)
}
