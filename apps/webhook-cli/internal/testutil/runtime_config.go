package testutil

import (
	"testing"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
)

type StaticConfigLoader struct {
	Config runtime.AppConfig
}

func (l StaticConfigLoader) Load(_ string) (runtime.AppConfig, error) {
	return l.Config, nil
}

func InitializeRuntimeConfig(t testing.TB, cmd *cobra.Command, config runtime.AppConfig) {
	t.Helper()
	if err := runtime.InitializeConfig(cmd, StaticConfigLoader{Config: config}); err != nil {
		t.Fatalf("initialize runtime config: %v", err)
	}
}
