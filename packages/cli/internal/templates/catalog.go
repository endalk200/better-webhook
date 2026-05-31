package templates

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
)

const (
	BuiltinCatalogVersion   = "2026.05.31"
	catalogMaxResponseBytes = 32 * 1024 * 1024
)

type Manager struct {
	Home string
}

type Template struct {
	SchemaVersion          string            `json:"schemaVersion"`
	ID                     string            `json:"id"`
	Name                   string            `json:"name"`
	Provider               string            `json:"provider,omitempty"`
	Event                  string            `json:"event,omitempty"`
	Version                string            `json:"version"`
	CatalogVersion         string            `json:"catalogVersion,omitempty"`
	Source                 string            `json:"source"`
	VerificationCompatible bool              `json:"verificationCompatible"`
	Method                 string            `json:"method"`
	Path                   string            `json:"path,omitempty"`
	Query                  string            `json:"query,omitempty"`
	Headers                []domain.Header   `json:"headers"`
	Body                   string            `json:"body"`
	Metadata               map[string]string `json:"metadata,omitempty"`
}

type Manifest struct {
	SchemaVersion  string          `json:"schemaVersion"`
	CatalogVersion string          `json:"catalogVersion"`
	Signature      string          `json:"signature,omitempty"`
	Templates      []ManifestEntry `json:"templates"`
}

type ManifestEntry struct {
	ID       string `json:"id"`
	Path     string `json:"path"`
	SHA256   string `json:"sha256"`
	Bytes    []byte `json:"-"`
	Source   string `json:"source,omitempty"`
	Verified bool   `json:"verified,omitempty"`
}

func NewManager(home string) (Manager, error) {
	if home == "" {
		home = os.Getenv("BW_TEMPLATE_HOME")
	}
	if home == "" {
		configDir, err := os.UserConfigDir()
		if err != nil {
			return Manager{}, err
		}
		home = filepath.Join(configDir, "better-webhook", "templates")
	}
	abs, err := filepath.Abs(home)
	if err != nil {
		return Manager{}, err
	}
	return Manager{Home: abs}, nil
}

func (m Manager) InstallBuiltin() (Manifest, error) {
	manifest := BuiltinManifest()
	if err := os.MkdirAll(m.officialDir(manifest.CatalogVersion), 0o755); err != nil {
		return Manifest{}, err
	}
	for _, entry := range manifest.Templates {
		if err := verifyEntry(entry); err != nil {
			return Manifest{}, err
		}
		path := filepath.Join(m.officialDir(manifest.CatalogVersion), entry.Path)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return Manifest{}, err
		}
		if err := os.WriteFile(path, entry.Bytes, 0o644); err != nil {
			return Manifest{}, err
		}
	}
	manifestPath := filepath.Join(m.officialDir(manifest.CatalogVersion), "manifest.json")
	data, err := json.MarshalIndent(manifestWithoutBytes(manifest), "", "\t")
	if err != nil {
		return Manifest{}, err
	}
	if err := os.WriteFile(manifestPath, append(data, '\n'), 0o644); err != nil {
		return Manifest{}, err
	}
	if err := os.WriteFile(filepath.Join(m.Home, "official", "latest"), []byte(manifest.CatalogVersion+"\n"), 0o644); err != nil {
		return Manifest{}, err
	}
	return manifestWithoutBytes(manifest), nil
}

func (m Manager) InstallFromManifest(manifestURL, trustedPublicKeyHex string) (Manifest, error) {
	if manifestURL == "" {
		return Manifest{}, errors.New("catalog manifest URL or path is required")
	}
	data, base, err := readURLOrFile(manifestURL)
	if err != nil {
		return Manifest{}, err
	}
	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return Manifest{}, fmt.Errorf("invalid catalog manifest: %w", err)
	}
	if manifest.SchemaVersion != domain.SchemaVersion {
		return Manifest{}, fmt.Errorf("unsupported catalog schemaVersion %q", manifest.SchemaVersion)
	}
	if manifest.CatalogVersion == "" {
		return Manifest{}, errors.New("catalogVersion is required")
	}
	if err := verifyManifestSignature(manifest, trustedPublicKeyHex); err != nil {
		return Manifest{}, err
	}

	targetDir := m.officialDir(manifest.CatalogVersion)
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return Manifest{}, err
	}
	for i, entry := range manifest.Templates {
		if entry.ID == "" || entry.Path == "" || entry.SHA256 == "" {
			return Manifest{}, fmt.Errorf("catalog template entry %d must include id, path, and sha256", i)
		}
		targetPath, err := safeCatalogPath(targetDir, entry.Path)
		if err != nil {
			return Manifest{}, err
		}
		templateURL := resolveRelative(base, entry.Path)
		bytes, _, err := readURLOrFile(templateURL)
		if err != nil {
			return Manifest{}, err
		}
		entry.Bytes = bytes
		if err := verifyEntry(entry); err != nil {
			return Manifest{}, err
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return Manifest{}, err
		}
		if err := os.WriteFile(targetPath, bytes, 0o644); err != nil {
			return Manifest{}, err
		}
		manifest.Templates[i].Source = templateURL
		manifest.Templates[i].Verified = true
	}
	data, err = json.MarshalIndent(manifestWithoutBytes(manifest), "", "\t")
	if err != nil {
		return Manifest{}, err
	}
	if err := os.WriteFile(filepath.Join(targetDir, "manifest.json"), append(data, '\n'), 0o644); err != nil {
		return Manifest{}, err
	}
	if err := os.WriteFile(filepath.Join(m.Home, "official", "latest"), []byte(manifest.CatalogVersion+"\n"), 0o644); err != nil {
		return Manifest{}, err
	}
	return manifestWithoutBytes(manifest), nil
}

func (m Manager) List(query string) ([]Template, error) {
	if err := m.ensureDefaultCatalog(); err != nil {
		return nil, err
	}
	var templates []Template
	for _, root := range []string{filepath.Join(m.Home, "official"), filepath.Join(m.Home, "user")} {
		if _, err := os.Stat(root); errors.Is(err, os.ErrNotExist) {
			continue
		}
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || !strings.HasSuffix(path, ".jsonc") {
				return nil
			}
			template, err := LoadTemplateFile(path)
			if err != nil {
				return err
			}
			if query == "" || strings.Contains(strings.ToLower(template.ID+" "+template.Name+" "+template.Provider+" "+template.Event), strings.ToLower(query)) {
				templates = append(templates, template)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	sort.Slice(templates, func(i, j int) bool {
		if templates[i].ID == templates[j].ID {
			return templates[i].Source < templates[j].Source
		}
		return templates[i].ID < templates[j].ID
	})
	return templates, nil
}

func (m Manager) Get(id string) (Template, string, error) {
	templates, err := m.List("")
	if err != nil {
		return Template{}, "", err
	}
	for _, template := range templates {
		if template.ID == id {
			path, err := m.findPath(id, template.Source)
			return template, path, err
		}
	}
	return Template{}, "", fmt.Errorf("template %q not found; run bw templates list", id)
}

func (m Manager) Fork(id, name string) (Template, string, error) {
	template, _, err := m.Get(id)
	if err != nil {
		return Template{}, "", err
	}
	if name == "" {
		name = strings.ReplaceAll(template.ID, "/", "__")
	}
	template.ID = name
	template.Source = "user"
	template.CatalogVersion = ""
	target := filepath.Join(m.Home, "user", templateFileName(name))
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return Template{}, "", err
	}
	data, err := json.MarshalIndent(template, "", "\t")
	if err != nil {
		return Template{}, "", err
	}
	if err := os.WriteFile(target, append([]byte("// User-owned better-webhook template copy.\n"), append(data, '\n')...), 0o644); err != nil {
		return Template{}, "", err
	}
	return template, target, nil
}

func LoadTemplateFile(path string) (Template, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Template{}, err
	}
	var template Template
	if err := json.Unmarshal(stripJSONComments(data), &template); err != nil {
		return Template{}, fmt.Errorf("invalid template %s: %w", path, err)
	}
	if template.SchemaVersion != domain.SchemaVersion {
		return Template{}, fmt.Errorf("template %s has unsupported schemaVersion %q", path, template.SchemaVersion)
	}
	if template.ID == "" || template.Method == "" {
		return Template{}, fmt.Errorf("template %s must include id and method", path)
	}
	if template.Body == "" {
		template.Body = `{}`
	}
	return template, nil
}

func BuiltinManifest() Manifest {
	entries := []ManifestEntry{
		builtinEntry("stripe/payment_intent.succeeded", "stripe/payment_intent.succeeded.jsonc", Template{
			SchemaVersion:          domain.SchemaVersion,
			ID:                     "stripe/payment_intent.succeeded",
			Name:                   "Stripe payment_intent.succeeded",
			Provider:               "stripe",
			Event:                  "payment_intent.succeeded",
			Version:                "1.0.0",
			CatalogVersion:         BuiltinCatalogVersion,
			Source:                 "official",
			VerificationCompatible: true,
			Method:                 http.MethodPost,
			Headers: []domain.Header{
				{Name: "Content-Type", Value: "application/json"},
			},
			Body:     `{"id":"evt_{{uuid}}","object":"event","api_version":"2025-02-24.acacia","created":{{timestamp_unix}},"type":"payment_intent.succeeded","data":{"object":{"id":"pi_{{uuid}}","object":"payment_intent","amount":2000,"currency":"usd","status":"succeeded"}}}`,
			Metadata: map[string]string{"capability": "local-verified"},
		}),
		builtinEntry("github/ping", "github/ping.jsonc", Template{
			SchemaVersion:          domain.SchemaVersion,
			ID:                     "github/ping",
			Name:                   "GitHub ping",
			Provider:               "github",
			Event:                  "ping",
			Version:                "1.0.0",
			CatalogVersion:         BuiltinCatalogVersion,
			Source:                 "official",
			VerificationCompatible: true,
			Method:                 http.MethodPost,
			Headers: []domain.Header{
				{Name: "Content-Type", Value: "application/json"},
				{Name: "X-GitHub-Event", Value: "ping"},
				{Name: "X-GitHub-Delivery", Value: "{{uuid}}"},
				{Name: "X-GitHub-Hook-ID", Value: "1"},
			},
			Body:     `{"zen":"Keep it logically awesome.","hook_id":1,"hook":{"type":"Repository","id":1,"name":"web","active":true},"repository":{"id":1,"name":"demo","full_name":"local/demo"}}`,
			Metadata: map[string]string{"capability": "local-verified"},
		}),
		builtinEntry("generic/json", "generic/json.jsonc", Template{
			SchemaVersion:          domain.SchemaVersion,
			ID:                     "generic/json",
			Name:                   "Generic JSON delivery",
			Version:                "1.0.0",
			CatalogVersion:         BuiltinCatalogVersion,
			Source:                 "official",
			VerificationCompatible: false,
			Method:                 http.MethodPost,
			Headers: []domain.Header{
				{Name: "Content-Type", Value: "application/json"},
			},
			Body:     `{"id":"{{uuid}}","createdAt":"{{timestamp_iso}}","message":"better-webhook local template"}`,
			Metadata: map[string]string{"capability": "exact"},
		}),
	}
	return Manifest{
		SchemaVersion:  domain.SchemaVersion,
		CatalogVersion: BuiltinCatalogVersion,
		Templates:      entries,
	}
}

func (m Manager) ensureDefaultCatalog() error {
	latest := filepath.Join(m.Home, "official", "latest")
	if _, err := os.Stat(latest); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	_, err := m.InstallBuiltin()
	return err
}

func (m Manager) officialDir(version string) string {
	return filepath.Join(m.Home, "official", version)
}

func (m Manager) findPath(id, source string) (string, error) {
	name := templateFileName(id)
	if source == "user" {
		return filepath.Join(m.Home, "user", name), nil
	}
	var found string
	err := filepath.WalkDir(filepath.Join(m.Home, "official"), func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if entry.IsDir() || filepath.Ext(path) != ".jsonc" {
			return nil
		}
		template, err := LoadTemplateFile(path)
		if err == nil && template.ID == id && template.Source == source {
			found = path
			return fs.SkipAll
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	return found, nil
}

func safeCatalogPath(root, relative string) (string, error) {
	clean := filepath.Clean(relative)
	if clean == "." || filepath.IsAbs(clean) {
		return "", fmt.Errorf("catalog template path %q escapes catalog directory", relative)
	}
	target := filepath.Join(root, clean)
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return "", err
	}
	if rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", fmt.Errorf("catalog template path %q escapes catalog directory", relative)
	}
	return target, nil
}

func templateFileName(id string) string {
	replacer := strings.NewReplacer("/", "__", "\\", "__")
	return replacer.Replace(id) + ".jsonc"
}

func builtinEntry(id, path string, template Template) ManifestEntry {
	data, err := json.MarshalIndent(template, "", "\t")
	if err != nil {
		panic(err)
	}
	data = append([]byte("// Managed better-webhook official template. Fork before editing.\n"), append(data, '\n')...)
	sum := sha256.Sum256(data)
	return ManifestEntry{
		ID:       id,
		Path:     path,
		SHA256:   hex.EncodeToString(sum[:]),
		Bytes:    data,
		Source:   "builtin",
		Verified: true,
	}
}

func verifyEntry(entry ManifestEntry) error {
	sum := sha256.Sum256(entry.Bytes)
	actual := hex.EncodeToString(sum[:])
	if !strings.EqualFold(actual, entry.SHA256) {
		return fmt.Errorf("checksum verification failed for template %q", entry.ID)
	}
	return nil
}

func verifyManifestSignature(manifest Manifest, trustedPublicKeyHex string) error {
	if trustedPublicKeyHex == "" {
		return errors.New("catalog signature verification requires --public-key")
	}
	if manifest.Signature == "" {
		return errors.New("catalog manifest is missing signature")
	}
	publicKey, err := hex.DecodeString(trustedPublicKeyHex)
	if err != nil {
		return fmt.Errorf("invalid catalog public key: %w", err)
	}
	if len(publicKey) != ed25519.PublicKeySize {
		return fmt.Errorf("invalid catalog public key length %d", len(publicKey))
	}
	signature, err := hex.DecodeString(manifest.Signature)
	if err != nil {
		return fmt.Errorf("invalid catalog signature: %w", err)
	}
	if !ed25519.Verify(ed25519.PublicKey(publicKey), canonicalManifestPayload(manifest), signature) {
		return errors.New("catalog signature verification failed")
	}
	return nil
}

func canonicalManifestPayload(manifest Manifest) []byte {
	entries := append([]ManifestEntry(nil), manifest.Templates...)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].ID < entries[j].ID
	})
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "schemaVersion=%s\ncatalogVersion=%s\n", manifest.SchemaVersion, manifest.CatalogVersion)
	for _, entry := range entries {
		fmt.Fprintf(&buf, "%s\t%s\t%s\n", entry.ID, entry.Path, strings.ToLower(entry.SHA256))
	}
	return buf.Bytes()
}

func manifestWithoutBytes(manifest Manifest) Manifest {
	clean := manifest
	clean.Templates = make([]ManifestEntry, len(manifest.Templates))
	for i, entry := range manifest.Templates {
		entry.Bytes = nil
		clean.Templates[i] = entry
	}
	return clean
}

func stripJSONComments(data []byte) []byte {
	out := make([]byte, 0, len(data))
	inString := false
	escaped := false
	inBlock := false
	inLine := false
	for i := 0; i < len(data); i++ {
		current := data[i]
		var next byte
		if i+1 < len(data) {
			next = data[i+1]
		}
		if inLine {
			if current == '\n' {
				inLine = false
				out = append(out, current)
			}
			continue
		}
		if inBlock {
			if current == '*' && next == '/' {
				inBlock = false
				i++
			}
			continue
		}
		if inString {
			out = append(out, current)
			if escaped {
				escaped = false
				continue
			}
			switch current {
			case '\\':
				escaped = true
			case '"':
				inString = false
			}
			continue
		}
		if current == '"' {
			inString = true
			out = append(out, current)
			continue
		}
		if current == '/' && next == '/' {
			inLine = true
			i++
			continue
		}
		if current == '/' && next == '*' {
			inBlock = true
			i++
			continue
		}
		out = append(out, current)
	}
	return out
}

func readURLOrFile(location string) ([]byte, string, error) {
	if strings.HasPrefix(location, "http://") || strings.HasPrefix(location, "https://") {
		client := &http.Client{Timeout: 30 * time.Second}
		response, err := client.Get(location)
		if err != nil {
			return nil, "", err
		}
		defer func() {
			_ = response.Body.Close()
		}()
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			return nil, "", fmt.Errorf("GET %s returned %s", location, response.Status)
		}
		var buf bytes.Buffer
		if _, err := buf.ReadFrom(io.LimitReader(response.Body, catalogMaxResponseBytes+1)); err != nil {
			return nil, "", err
		}
		if buf.Len() > catalogMaxResponseBytes {
			return nil, "", fmt.Errorf("GET %s exceeded %d bytes", location, catalogMaxResponseBytes)
		}
		return buf.Bytes(), location, nil
	}
	data, err := os.ReadFile(location)
	if err != nil {
		return nil, "", err
	}
	abs, err := filepath.Abs(location)
	if err != nil {
		return nil, "", err
	}
	return data, abs, nil
}

func resolveRelative(base, value string) string {
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") || filepath.IsAbs(value) {
		return value
	}
	if strings.HasPrefix(base, "http://") || strings.HasPrefix(base, "https://") {
		idx := strings.LastIndex(base, "/")
		if idx < 0 {
			return value
		}
		return base[:idx+1] + value
	}
	return filepath.Join(filepath.Dir(base), value)
}
