package templates

import "errors"

var (
	ErrInvalidProviderFilter = errors.New("provider filter is invalid")
	ErrRunNotConfigured      = errors.New("template run is not configured")
	ErrRunTargetURLRequired  = errors.New("template run target URL is required")
	ErrRunInvalidTargetURL   = errors.New("template run target URL is invalid")
	ErrRunInvalidMethod      = errors.New("template run method is invalid")
	ErrRunInvalidBody        = errors.New("template run body is invalid")
	ErrRunTimeoutInvalid     = errors.New("template run timeout is invalid")
	ErrRunSecretRequired     = errors.New("template run secret is required")
)
