package capture

import "errors"

var (
	ErrCaptureNotFound   = errors.New("capture not found")
	ErrAmbiguousSelector = errors.New("capture selector is ambiguous")
	ErrInvalidLimit      = errors.New("limit must be a positive integer")
	ErrInvalidSelector   = errors.New("capture selector cannot be empty")
)
