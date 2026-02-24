package httprequest

import "strings"

type HeaderEntry struct {
	Key   string
	Value string
}

// ShouldSkipHopByHopHeader filters transport-managed headers for replay.
// Besides standard hop-by-hop headers, it intentionally excludes host and
// content-length to avoid replaying stale connection metadata.
func ShouldSkipHopByHopHeader(key string) bool {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "host", "content-length", "connection", "accept-encoding", "transfer-encoding", "te", "trailer", "proxy-connection", "upgrade":
		return true
	default:
		return false
	}
}

func ApplyHeaderOverrides(headers []HeaderEntry, overrides []HeaderEntry) []HeaderEntry {
	if len(overrides) == 0 {
		return headers
	}

	overrideByKey := make(map[string]HeaderEntry, len(overrides))
	overrideOrder := make([]string, 0, len(overrides))
	for _, override := range overrides {
		key := strings.TrimSpace(override.Key)
		value := strings.TrimSpace(override.Value)
		if key == "" || value == "" || ShouldSkipHopByHopHeader(key) {
			continue
		}
		lowerKey := strings.ToLower(key)
		if _, exists := overrideByKey[lowerKey]; !exists {
			overrideOrder = append(overrideOrder, lowerKey)
		}
		overrideByKey[lowerKey] = HeaderEntry{
			Key:   key,
			Value: value,
		}
	}

	result := make([]HeaderEntry, 0, len(headers)+len(overrideByKey))
	applied := make(map[string]bool, len(overrideByKey))
	for _, header := range headers {
		lowerKey := strings.ToLower(strings.TrimSpace(header.Key))
		override, hasOverride := overrideByKey[lowerKey]
		if hasOverride {
			result = append(result, override)
			applied[lowerKey] = true
			continue
		}
		result = append(result, header)
	}

	for _, lowerKey := range overrideOrder {
		if applied[lowerKey] {
			continue
		}
		result = append(result, overrideByKey[lowerKey])
	}

	return result
}

func IsValidHTTPMethod(method string) bool {
	if len(method) == 0 {
		return false
	}
	for _, r := range method {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
		isTokenPunctuation := strings.ContainsRune("!#$%&'*+-.^_`|~", r)
		if !isAlphaNum && !isTokenPunctuation {
			return false
		}
	}
	return true
}
