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

// DetectionResult holds the outcome of a provider detection attempt.
type DetectionResult struct {
	Provider string
	// Confidence is in the range [0.0, 1.0], where 1.0 is highest certainty.
	Confidence float64
}
