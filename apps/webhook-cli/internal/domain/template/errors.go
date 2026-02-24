package template

import "errors"

var (
	ErrTemplateNotFound         = errors.New("template not found")
	ErrTemplateAlreadyExists    = errors.New("template already exists")
	ErrInvalidTemplateID        = errors.New("template id is invalid")
	ErrInvalidTemplateQuery     = errors.New("template query is invalid")
	ErrTemplateIndexUnavailable = errors.New("template index is unavailable")
)
