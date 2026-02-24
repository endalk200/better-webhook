package capture

import "encoding/json"

const BodyEncodingBase64 = "base64"

type HeaderEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CaptureRecord struct {
	ID                string          `json:"id"`
	Timestamp         string          `json:"timestamp"`
	Method            string          `json:"method"`
	URL               string          `json:"url"`
	Path              string          `json:"path"`
	Headers           []HeaderEntry   `json:"headers"`
	RemoteAddr        string          `json:"remote_addr,omitempty"`
	ContentType       string          `json:"content_type,omitempty"`
	ContentLength     int64           `json:"content_length"`
	RawBodyBase64     string          `json:"raw_body_base64"`
	ParsedJSONPreview json.RawMessage `json:"parsed_json_preview,omitempty"`
	Provider          string          `json:"provider"`
	Meta              CaptureMeta     `json:"_meta"`
}

type CaptureMeta struct {
	StoredAt           string `json:"stored_at"`
	BodyEncoding       string `json:"body_encoding"`
	CaptureToolVersion string `json:"capture_tool_version"`
}

type CaptureFile struct {
	File    string
	Capture CaptureRecord
}
