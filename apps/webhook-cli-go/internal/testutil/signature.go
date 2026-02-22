package testutil

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

func ComputeSignatureHex(body []byte, secret string) string {
	signature := hmac.New(sha256.New, []byte(secret))
	_, _ = signature.Write(body)
	return "sha256=" + hex.EncodeToString(signature.Sum(nil))
}
