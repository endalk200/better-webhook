package id

import "github.com/google/uuid"

type Generator interface {
	NewID() string
}

type UUIDGenerator struct{}

func (UUIDGenerator) NewID() string {
	return uuid.NewString()
}
