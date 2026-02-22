package placeholders

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	platformid "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/id"
	platformtime "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/platform/time"
)

const (
	uuidPlaceholder                     = "$uuid"
	timeUnixPlaceholder                 = "$time:unix"
	timeRFC3339Placeholder              = "$time:rfc3339"
	githubSignature256Placeholder       = "$github:x-hub-signature-256"
	legacySignaturePlaceholder          = "placeholder"
	githubProvider                      = "github"
	githubSignatureHeader               = "x-hub-signature-256"
	githubSignaturePrefix               = "sha256="
	genericEnvironmentPrefixPlaceholder = "$env:"
	genericTimePrefixPlaceholder        = "$time:"
	githubPrefixPlaceholder             = "$github:"
)

var (
	ErrMissingEnvironmentVariable      = errors.New("placeholder environment variable is not set")
	ErrEnvironmentPlaceholdersDisabled = errors.New("environment placeholders are disabled")
	ErrMissingSecret                   = errors.New("provider signing secret is required")
	ErrUnsupportedTimeFormat           = errors.New("time placeholder format is not supported")
	ErrUnsupportedProviderToken        = errors.New("provider placeholder token is not supported")
)

type ResolverOption func(*Resolver)

type HeaderContext struct {
	Provider string
	Secret   string
	Body     []byte
}

type Resolver struct {
	clock                        platformtime.Clock
	idGenerator                  platformid.Generator
	lookupEnv                    func(string) (string, bool)
	allowEnvironmentPlaceholders bool
}

func NewResolver(
	clock platformtime.Clock,
	idGenerator platformid.Generator,
	lookupEnv func(string) (string, bool),
	options ...ResolverOption,
) *Resolver {
	if clock == nil {
		clock = platformtime.SystemClock{}
	}
	if idGenerator == nil {
		idGenerator = platformid.UUIDGenerator{}
	}
	if lookupEnv == nil {
		lookupEnv = os.LookupEnv
	}
	resolver := &Resolver{
		clock:       clock,
		idGenerator: idGenerator,
		lookupEnv:   lookupEnv,
	}
	for _, option := range options {
		option(resolver)
	}
	return resolver
}

func WithEnvironmentPlaceholdersEnabled(enabled bool) ResolverOption {
	return func(resolver *Resolver) {
		if resolver == nil {
			return
		}
		resolver.allowEnvironmentPlaceholders = enabled
	}
}

func (r *Resolver) WithEnvironmentPlaceholdersEnabled(enabled bool) *Resolver {
	if r == nil {
		return nil
	}
	clone := *r
	clone.allowEnvironmentPlaceholders = enabled
	return &clone
}

func (r *Resolver) ResolveBody(body json.RawMessage) ([]byte, error) {
	if len(strings.TrimSpace(string(body))) == 0 {
		return []byte{}, nil
	}
	var decoded interface{}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, err
	}
	resolved, err := r.resolveValue(decoded)
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(resolved)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

func (r *Resolver) ResolveHeaderValue(key string, value string, ctx HeaderContext) (string, error) {
	trimmedValue := strings.TrimSpace(value)
	if isGitHubSignaturePlaceholder(strings.TrimSpace(key), trimmedValue, strings.TrimSpace(ctx.Provider)) {
		return buildGitHubSignature(ctx.Body, ctx.Secret)
	}
	resolved, err := r.resolveString(trimmedValue)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(resolved, githubPrefixPlaceholder) {
		return "", fmt.Errorf("%w: %s", ErrUnsupportedProviderToken, resolved)
	}
	return resolved, nil
}

func (r *Resolver) resolveValue(value interface{}) (interface{}, error) {
	switch typed := value.(type) {
	case string:
		return r.resolveString(typed)
	case []interface{}:
		resolved := make([]interface{}, len(typed))
		for idx := range typed {
			item, err := r.resolveValue(typed[idx])
			if err != nil {
				return nil, err
			}
			resolved[idx] = item
		}
		return resolved, nil
	case map[string]interface{}:
		resolved := make(map[string]interface{}, len(typed))
		for key, raw := range typed {
			valueItem, err := r.resolveValue(raw)
			if err != nil {
				return nil, err
			}
			resolved[key] = valueItem
		}
		return resolved, nil
	default:
		return value, nil
	}
}

func (r *Resolver) resolveString(value string) (string, error) {
	if !strings.Contains(value, "$") {
		return value, nil
	}

	var builder strings.Builder
	builder.Grow(len(value))

	for idx := 0; idx < len(value); {
		if value[idx] == '\\' {
			if idx+1 < len(value) && value[idx+1] == '$' {
				builder.WriteByte('$')
				idx += 2
				continue
			}
			builder.WriteByte(value[idx])
			idx++
			continue
		}

		if value[idx] != '$' {
			builder.WriteByte(value[idx])
			idx++
			continue
		}

		replacement, consumed, matched, err := r.resolveInterpolatedToken(value[idx:])
		if err != nil {
			return "", err
		}
		if matched {
			builder.WriteString(replacement)
			idx += consumed
			continue
		}

		builder.WriteByte('$')
		idx++
	}

	return builder.String(), nil
}

func (r *Resolver) resolveInterpolatedToken(value string) (string, int, bool, error) {
	switch {
	case hasTokenWithBoundary(value, uuidPlaceholder):
		return r.idGenerator.NewID(), len(uuidPlaceholder), true, nil
	case hasTokenWithBoundary(value, timeUnixPlaceholder):
		return fmt.Sprintf("%d", r.clock.Now().UTC().Unix()), len(timeUnixPlaceholder), true, nil
	case hasTokenWithBoundary(value, timeRFC3339Placeholder):
		return r.clock.Now().UTC().Format(timeFormatRFC3339), len(timeRFC3339Placeholder), true, nil
	case strings.HasPrefix(value, genericEnvironmentPrefixPlaceholder):
		return r.resolveEnvironmentToken(value)
	case strings.HasPrefix(value, genericTimePrefixPlaceholder):
		return "", 0, false, fmt.Errorf("%w: %s", ErrUnsupportedTimeFormat, readPlaceholderToken(value))
	case strings.HasPrefix(value, githubPrefixPlaceholder):
		return "", 0, false, fmt.Errorf("%w: %s", ErrUnsupportedProviderToken, readPlaceholderToken(value))
	default:
		return "", 0, false, nil
	}
}

func (r *Resolver) resolveEnvironmentToken(value string) (string, int, bool, error) {
	remainder := value[len(genericEnvironmentPrefixPlaceholder):]
	trimmedLeading := strings.TrimLeft(remainder, " \t")
	leadingWhitespace := len(remainder) - len(trimmedLeading)
	if trimmedLeading == "" {
		return "", 0, false, fmt.Errorf("%w: variable name cannot be empty", ErrMissingEnvironmentVariable)
	}

	end := 0
	for end < len(trimmedLeading) && isEnvironmentVariableChar(trimmedLeading[end]) {
		end++
	}
	if end == 0 {
		return "", 0, false, nil
	}

	envKey := trimmedLeading[:end]
	if !r.allowEnvironmentPlaceholders {
		return "", 0, false, fmt.Errorf("%w: %s", ErrEnvironmentPlaceholdersDisabled, envKey)
	}
	envValue, ok := r.lookupEnv(envKey)
	if !ok {
		return "", 0, false, fmt.Errorf("%w: %s", ErrMissingEnvironmentVariable, envKey)
	}

	consumed := len(genericEnvironmentPrefixPlaceholder) + leadingWhitespace + end
	return envValue, consumed, true, nil
}

func hasTokenWithBoundary(value string, token string) bool {
	if !strings.HasPrefix(value, token) {
		return false
	}
	return isPlaceholderBoundary(value, len(token))
}

func isPlaceholderBoundary(value string, index int) bool {
	if index >= len(value) {
		return true
	}
	return !isEnvironmentVariableChar(value[index])
}

func isEnvironmentVariableChar(value byte) bool {
	return value == '_' ||
		(value >= 'a' && value <= 'z') ||
		(value >= 'A' && value <= 'Z') ||
		(value >= '0' && value <= '9')
}

func readPlaceholderToken(value string) string {
	if value == "" || value[0] != '$' {
		return value
	}
	end := 1
	for end < len(value) {
		char := value[end]
		if char == ':' || char == '_' || char == '-' ||
			(char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') {
			end++
			continue
		}
		break
	}
	return value[:end]
}

func isGitHubSignaturePlaceholder(key string, value string, provider string) bool {
	if strings.EqualFold(value, githubSignature256Placeholder) {
		return strings.EqualFold(provider, githubProvider)
	}
	return strings.EqualFold(provider, githubProvider) &&
		strings.EqualFold(key, githubSignatureHeader) &&
		strings.EqualFold(value, legacySignaturePlaceholder)
}

func buildGitHubSignature(body []byte, secret string) (string, error) {
	trimmedSecret := strings.TrimSpace(secret)
	if trimmedSecret == "" {
		return "", ErrMissingSecret
	}
	signature := hmac.New(sha256.New, []byte(trimmedSecret))
	if _, err := signature.Write(body); err != nil {
		return "", err
	}
	return githubSignaturePrefix + hex.EncodeToString(signature.Sum(nil)), nil
}

const timeFormatRFC3339 = "2006-01-02T15:04:05Z07:00"
