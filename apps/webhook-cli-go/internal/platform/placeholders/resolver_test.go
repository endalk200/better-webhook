package placeholders

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

type fixedClock struct {
	now time.Time
}

func (c fixedClock) Now() time.Time {
	return c.now
}

type fixedIDGenerator struct {
	id string
}

func (g fixedIDGenerator) NewID() string {
	return g.id
}

func TestResolveBodyResolvesKnownPlaceholders(t *testing.T) {
	now := time.Date(2026, time.February, 22, 12, 0, 0, 0, time.UTC)
	resolver := NewResolver(
		fixedClock{now: now},
		fixedIDGenerator{id: "delivery-uuid"},
		func(key string) (string, bool) {
			if key == "BW_SOURCE" {
				return "tests", true
			}
			return "", false
		},
		WithEnvironmentPlaceholdersEnabled(true),
	)

	resolvedBody, err := resolver.ResolveBody(json.RawMessage(`{
  "id":"$uuid",
  "sent_at":"$time:rfc3339",
  "unix":"$time:unix",
  "source":"$env:BW_SOURCE"
}`))
	if err != nil {
		t.Fatalf("resolve body: %v", err)
	}

	decoded := map[string]string{}
	if err := json.Unmarshal(resolvedBody, &decoded); err != nil {
		t.Fatalf("unmarshal resolved body: %v", err)
	}

	if decoded["id"] != "delivery-uuid" {
		t.Fatalf("uuid placeholder mismatch: got %q", decoded["id"])
	}
	if decoded["sent_at"] != "2026-02-22T12:00:00Z" {
		t.Fatalf("rfc3339 placeholder mismatch: got %q", decoded["sent_at"])
	}
	if decoded["unix"] != "1771761600" {
		t.Fatalf("unix placeholder mismatch: got %q", decoded["unix"])
	}
	if decoded["source"] != "tests" {
		t.Fatalf("env placeholder mismatch: got %q", decoded["source"])
	}
}

func TestResolveBodyInterpolatesPlaceholdersAndSupportsEscaping(t *testing.T) {
	now := time.Date(2026, time.February, 22, 12, 0, 0, 0, time.UTC)
	resolver := NewResolver(
		fixedClock{now: now},
		fixedIDGenerator{id: "delivery-uuid"},
		func(key string) (string, bool) {
			if key == "BW_SOURCE" {
				return "tests", true
			}
			return "", false
		},
		WithEnvironmentPlaceholdersEnabled(true),
	)

	resolvedBody, err := resolver.ResolveBody(json.RawMessage(`{
  "request_id":"req-$uuid",
  "source":"env-$env:BW_SOURCE",
  "sent_at":"time-$time:rfc3339",
  "escaped":"\\$uuid"
}`))
	if err != nil {
		t.Fatalf("resolve interpolated body: %v", err)
	}

	decoded := map[string]string{}
	if err := json.Unmarshal(resolvedBody, &decoded); err != nil {
		t.Fatalf("unmarshal resolved body: %v", err)
	}

	if decoded["request_id"] != "req-delivery-uuid" {
		t.Fatalf("interpolated uuid mismatch: got %q", decoded["request_id"])
	}
	if decoded["source"] != "env-tests" {
		t.Fatalf("interpolated env mismatch: got %q", decoded["source"])
	}
	if decoded["sent_at"] != "time-2026-02-22T12:00:00Z" {
		t.Fatalf("interpolated time mismatch: got %q", decoded["sent_at"])
	}
	if decoded["escaped"] != "$uuid" {
		t.Fatalf("escaped placeholder mismatch: got %q", decoded["escaped"])
	}
}

func TestResolveBodyRejectsEnvPlaceholdersWhenDisabled(t *testing.T) {
	resolver := NewResolver(
		fixedClock{now: time.Now().UTC()},
		fixedIDGenerator{id: "delivery-uuid"},
		func(string) (string, bool) { return "value", true },
	)

	_, err := resolver.ResolveBody(json.RawMessage(`{"source":"$env:BW_SOURCE"}`))
	if !errors.Is(err, ErrEnvironmentPlaceholdersDisabled) {
		t.Fatalf("expected ErrEnvironmentPlaceholdersDisabled, got %v", err)
	}
}

func TestResolveBodyRejectsUnsupportedTimeFormatDuringInterpolation(t *testing.T) {
	resolver := NewResolver(
		fixedClock{now: time.Now().UTC()},
		nil,
		nil,
		WithEnvironmentPlaceholdersEnabled(true),
	)

	_, err := resolver.ResolveBody(json.RawMessage(`{"sent_at":"at-$time:milliseconds"}`))
	if !errors.Is(err, ErrUnsupportedTimeFormat) {
		t.Fatalf("expected ErrUnsupportedTimeFormat, got %v", err)
	}
}

func TestResolveBodyRejectsEmptyEnvVariableName(t *testing.T) {
	resolver := NewResolver(
		fixedClock{now: time.Now().UTC()},
		nil,
		func(string) (string, bool) { return "", false },
		WithEnvironmentPlaceholdersEnabled(true),
	)

	_, err := resolver.ResolveBody(json.RawMessage(`{"source":"$env:   "}`))
	if !errors.Is(err, ErrMissingEnvironmentVariable) {
		t.Fatalf("expected ErrMissingEnvironmentVariable, got %v", err)
	}
}

func TestResolveHeaderValueRejectsUnsupportedProviderToken(t *testing.T) {
	resolver := NewResolver(
		fixedClock{now: time.Now().UTC()},
		nil,
		nil,
		WithEnvironmentPlaceholdersEnabled(true),
	)

	_, err := resolver.ResolveHeaderValue("X-Test", "$github:delivery", HeaderContext{
		Provider: "github",
		Secret:   "secret",
		Body:     []byte(`{"ok":true}`),
	})
	if !errors.Is(err, ErrUnsupportedProviderToken) {
		t.Fatalf("expected ErrUnsupportedProviderToken, got %v", err)
	}
}

func TestResolveHeaderValueGeneratesGitHubSignature(t *testing.T) {
	resolver := NewResolver(
		fixedClock{now: time.Now().UTC()},
		nil,
		nil,
		WithEnvironmentPlaceholdersEnabled(true),
	)
	body := []byte(`{"ok":true}`)

	value, err := resolver.ResolveHeaderValue("X-Hub-Signature-256", "$github:x-hub-signature-256", HeaderContext{
		Provider: "github",
		Secret:   "top-secret",
		Body:     body,
	})
	if err != nil {
		t.Fatalf("resolve header value: %v", err)
	}

	signature := hmac.New(sha256.New, []byte("top-secret"))
	_, _ = signature.Write(body)
	expected := "sha256=" + hex.EncodeToString(signature.Sum(nil))
	if value != expected {
		t.Fatalf("signature mismatch: got %q want %q", value, expected)
	}
}

func TestResolveHeaderValueReturnsSecretErrorForGitHubSignature(t *testing.T) {
	resolver := NewResolver(
		fixedClock{now: time.Now().UTC()},
		nil,
		nil,
		WithEnvironmentPlaceholdersEnabled(true),
	)

	_, err := resolver.ResolveHeaderValue("X-Hub-Signature-256", "$github:x-hub-signature-256", HeaderContext{
		Provider: "github",
		Secret:   "",
		Body:     []byte(`{"ok":true}`),
	})
	if !errors.Is(err, ErrMissingSecret) {
		t.Fatalf("expected ErrMissingSecret, got %v", err)
	}
}
