package replay

import "errors"

var (
	ErrInvalidTargetURL = errors.New("replay target URL is invalid")
	ErrInvalidBaseURL   = errors.New("replay base URL is invalid")
	ErrInvalidMethod    = errors.New("replay method is invalid")
	ErrInvalidBody      = errors.New("captured body is invalid")
)
