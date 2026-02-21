package capture

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"

	domain "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/domain/capture"
)

const parsedJSONPreviewLimitBytes = 64 * 1024

type Service struct {
	repo        CaptureRepository
	detector    ProviderDetector
	relay       RelayDispatcher
	toolVersion string
}

type noopProviderDetector struct{}

func (d noopProviderDetector) Detect(domain.DetectionContext) domain.DetectionResult {
	return domain.DetectionResult{Provider: domain.ProviderUnknown}
}

type noopRelayDispatcher struct{}

func (d noopRelayDispatcher) OnCaptureStored(context.Context, domain.CaptureFile) error {
	return nil
}

type IngestRequest struct {
	Method     string
	URL        string
	Path       string
	Headers    []domain.HeaderEntry
	RemoteAddr string
	Body       []byte
}

type IngestResult struct {
	Saved    domain.CaptureFile
	RelayErr error
}

func NewService(
	repo CaptureRepository,
	detector ProviderDetector,
	relay RelayDispatcher,
	toolVersion string,
) *Service {
	if repo == nil {
		panic("repo cannot be nil")
	}
	if detector == nil {
		detector = noopProviderDetector{}
	}
	if relay == nil {
		relay = noopRelayDispatcher{}
	}
	return &Service{
		repo:        repo,
		detector:    detector,
		relay:       relay,
		toolVersion: toolVersion,
	}
}

func (s *Service) EnsureStorageDir(ctx context.Context) error {
	return s.repo.EnsureStorageDir(ctx)
}

func (s *Service) Ingest(ctx context.Context, request IngestRequest) (IngestResult, error) {
	bodyBytes := request.Body
	contentType := firstHeaderValue(request.Headers, "content-type")

	detection := s.detector.Detect(domain.DetectionContext{
		Method:  request.Method,
		Path:    request.Path,
		Headers: request.Headers,
		Body:    bodyBytes,
	})

	provider := detection.Provider
	if provider == "" {
		provider = domain.ProviderUnknown
	}

	record := s.repo.BuildBaseRecord(s.toolVersion)
	record.Method = strings.ToUpper(request.Method)
	record.URL = request.URL
	record.Path = request.Path
	record.Headers = request.Headers
	record.RemoteAddr = request.RemoteAddr
	record.ContentType = contentType
	record.ContentLength = int64(len(bodyBytes))
	record.RawBodyBase64 = base64.StdEncoding.EncodeToString(bodyBytes)
	record.Provider = provider

	if isJSONPayload(record.ContentType) && len(bodyBytes) <= parsedJSONPreviewLimitBytes && json.Valid(bodyBytes) {
		record.ParsedJSONPreview = append(json.RawMessage{}, bodyBytes...)
	}

	saved, err := s.repo.Save(ctx, record)
	if err != nil {
		return IngestResult{}, err
	}

	relayErr := s.relay.OnCaptureStored(ctx, saved)
	return IngestResult{
		Saved:    saved,
		RelayErr: relayErr,
	}, nil
}

func firstHeaderValue(headers []domain.HeaderEntry, key string) string {
	for _, header := range headers {
		if strings.EqualFold(header.Key, key) {
			return header.Value
		}
	}
	return ""
}

func isJSONPayload(contentType string) bool {
	lower := strings.ToLower(contentType)
	return strings.Contains(lower, "application/json") || strings.Contains(lower, "+json")
}
