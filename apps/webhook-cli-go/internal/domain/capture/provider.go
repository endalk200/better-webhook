package capture

const (
	ProviderUnknown = "unknown"
	ProviderGitHub  = "github"
)

type DetectionContext struct {
	Method  string
	Path    string
	Headers []HeaderEntry
	Body    []byte
}

type DetectionResult struct {
	Provider   string
	Confidence float64
}
