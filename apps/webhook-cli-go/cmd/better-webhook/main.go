package main

import (
	"fmt"
	"os"

	appcapture "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/capture"
	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/app/captures"
	configtoml "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/config/toml"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/provider"
	githubdetector "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/provider/github"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/storage/jsonc"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/adapters/transport/httpcapture"
	capturecmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/capture"
	capturescmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/captures"
	rootcmd "github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/cli/root"
	"github.com/endalk200/better-webhook/apps/webhook-cli-go/internal/version"
)

func main() {
	rootCommand := rootcmd.NewCommand(rootcmd.Dependencies{
		Version:      version.Version,
		ConfigLoader: configtoml.NewLoader(),
		CaptureDependencies: capturecmd.Dependencies{
			ServiceFactory: newCaptureService,
			ServerFactory:  httpcapture.NewServer,
		},
		CapturesDependencies: capturescmd.Dependencies{
			ServiceFactory: newCapturesService,
		},
	})

	if err := rootCommand.Execute(); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func newStore(capturesDir string) (*jsonc.Store, error) {
	return jsonc.NewStore(capturesDir, nil, nil)
}

func newCaptureService(capturesDir string) (*appcapture.Service, error) {
	store, err := newStore(capturesDir)
	if err != nil {
		return nil, err
	}
	detector := provider.NewRegistry(
		githubdetector.NewDetector(),
	)
	return appcapture.NewService(store, detector, nil, version.Version), nil
}

func newCapturesService(capturesDir string) (*appcaptures.Service, error) {
	store, err := newStore(capturesDir)
	if err != nil {
		return nil, err
	}
	return appcaptures.NewService(store), nil
}
