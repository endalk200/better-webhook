package domain

import "time"

const (
	ConfigDirName     = ".better-webhook"
	ProjectConfigName = "project.json"
	SchemaVersion     = "1"
)

type ProjectConfig struct {
	SchemaVersion        string            `json:"schemaVersion"`
	Name                 string            `json:"name"`
	Gateway              GatewayConfig     `json:"gateway"`
	Capture              CaptureConfig     `json:"capture"`
	Endpoints            []EndpointProfile `json:"endpoints"`
	TemplateRunHistory   []TemplateRun     `json:"templateRunHistory,omitempty"`
	LastTemplateRunPrune string            `json:"lastTemplateRunPrune,omitempty"`
	Metadata             map[string]string `json:"metadata,omitempty"`
}

type GatewayConfig struct {
	ListenAddress string `json:"listenAddress"`
	Port          int    `json:"port"`
}

type CaptureConfig struct {
	StorePath     string `json:"storePath,omitempty"`
	RetentionDays int    `json:"retentionDays"`
}

type EndpointMode string

const (
	EndpointModeGeneric  EndpointMode = "generic"
	EndpointModeProvider EndpointMode = "provider"
)

type EndpointProfile struct {
	ID        string           `json:"id"`
	Mode      EndpointMode     `json:"mode"`
	Provider  string           `json:"provider,omitempty"`
	TargetURL string           `json:"targetUrl"`
	Route     string           `json:"route"`
	Secret    *ProviderSecret  `json:"secret,omitempty"`
	CreatedAt string           `json:"createdAt"`
	UpdatedAt string           `json:"updatedAt"`
	Metadata  map[string]any   `json:"metadata,omitempty"`
	Warnings  []EndpointNotice `json:"warnings,omitempty"`
}

type ProviderSecret struct {
	Env string `json:"env,omitempty"`
}

type EndpointNotice struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type TemplateRun struct {
	TemplateID      string `json:"templateId"`
	TemplateSource  string `json:"templateSource"`
	CatalogVersion  string `json:"catalogVersion,omitempty"`
	TemplateVersion string `json:"templateVersion,omitempty"`
	EndpointID      string `json:"endpointId"`
	Provider        string `json:"provider,omitempty"`
	RunAt           string `json:"runAt"`
}

type Header struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type Capture struct {
	SchemaVersion string          `json:"schemaVersion"`
	ID            string          `json:"id"`
	EndpointID    string          `json:"endpointId"`
	Provider      string          `json:"provider,omitempty"`
	CapturedAt    string          `json:"capturedAt"`
	Request       CapturedRequest `json:"request"`
	Forward       *ForwardResult  `json:"forward,omitempty"`
	Analysis      CaptureAnalysis `json:"analysis"`
}

type CapturedRequest struct {
	Method     string   `json:"method"`
	Path       string   `json:"path"`
	RawQuery   string   `json:"rawQuery,omitempty"`
	Headers    []Header `json:"headers"`
	BodyBase64 string   `json:"bodyBase64"`
	BodySHA256 string   `json:"bodySha256"`
}

type CaptureAnalysis struct {
	ProviderDetected bool     `json:"providerDetected"`
	DetectedProvider string   `json:"detectedProvider,omitempty"`
	Warnings         []string `json:"warnings,omitempty"`
	Capabilities     []string `json:"capabilities,omitempty"`
}

type ForwardResult struct {
	TargetURL      string `json:"targetUrl"`
	StatusCode     int    `json:"statusCode,omitempty"`
	DurationMillis int64  `json:"durationMillis"`
	Error          string `json:"error,omitempty"`
}

type DeliveryResult struct {
	TargetURL      string   `json:"targetUrl"`
	StatusCode     int      `json:"statusCode,omitempty"`
	DurationMillis int64    `json:"durationMillis"`
	ResponseBody   string   `json:"responseBody,omitempty"`
	Error          string   `json:"error,omitempty"`
	Headers        []Header `json:"headers,omitempty"`
}

type ReplayMode string

const (
	ReplayModeExact         ReplayMode = "exact"
	ReplayModeLocalVerified ReplayMode = "local-verified"
)

func NowString(now time.Time) string {
	return now.UTC().Format(time.RFC3339Nano)
}
