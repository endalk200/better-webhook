package template

import (
	"encoding/json"
)

type TemplateMetadata struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Provider    string `json:"provider"`
	Event       string `json:"event"`
	File        string `json:"file"`
	Version     string `json:"version,omitempty"`
	DocsURL     string `json:"docsUrl,omitempty"`
}

type TemplatesIndex struct {
	Version   string             `json:"version"`
	Templates []TemplateMetadata `json:"templates"`
}

type WebhookTemplate struct {
	URL         string          `json:"url,omitempty"`
	Method      string          `json:"method"`
	Headers     []HeaderEntry   `json:"headers,omitempty"`
	Body        json.RawMessage `json:"body,omitempty"`
	Provider    string          `json:"provider,omitempty"`
	Event       string          `json:"event,omitempty"`
	Description string          `json:"description,omitempty"`
}

type HeaderEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type LocalTemplate struct {
	ID           string
	Metadata     TemplateMetadata
	Template     WebhookTemplate
	DownloadedAt string
	FilePath     string
}

type RemoteTemplate struct {
	Metadata     TemplateMetadata
	IsDownloaded bool
}
