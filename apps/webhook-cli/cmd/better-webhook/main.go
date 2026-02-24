package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	configtoml "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/config/toml"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider"
	githubdetector "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/provider/github"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/storage/jsonc"
	templatestore "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/storage/template"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/transport/httpcapture"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/transport/httpreplay"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/transport/httptemplaterun"
	httptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/transport/httptemplates"
	appcapture "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/capture"
	appcaptures "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/captures"
	appreplay "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/replay"
	apptemplates "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/templates"
	capturecmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/capture"
	capturescmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/captures"
	replaycmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/replay"
	rootcmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/root"
	templatescmd "github.com/endalk200/better-webhook/apps/webhook-cli/internal/cli/templates"
	platformtime "github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/time"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/version"
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
			ReplayDependencies: replaycmd.Dependencies{
				ServiceFactory: newReplayService,
			},
		},
		TemplateDependencies: templatescmd.Dependencies{
			ServiceFactory: newTemplateService,
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

func newReplayService(capturesDir string) (*appreplay.Service, error) {
	store, err := newStore(capturesDir)
	if err != nil {
		return nil, err
	}
	dispatcher := httpreplay.NewClient(&http.Client{Timeout: httptemplates.DefaultHTTPTimeout})
	return appreplay.NewService(store, dispatcher), nil
}

func newTemplateService(templatesDir string) (*apptemplates.Service, error) {
	localStore, err := templatestore.NewStore(templatesDir)
	if err != nil {
		return nil, err
	}
	cacheStore, err := templatestore.NewCache(filepath.Join(templatesDir, ".index-cache.json"))
	if err != nil {
		return nil, err
	}
	remoteStore, err := httptemplates.NewClient(httptemplates.ClientOptions{
		BaseURL:    httptemplates.DefaultBaseURL,
		HTTPClient: &http.Client{Timeout: httptemplates.DefaultHTTPTimeout},
	})
	if err != nil {
		return nil, err
	}
	dispatcher := httptemplaterun.NewDispatcher(
		httpreplay.NewClient(&http.Client{Timeout: httptemplates.DefaultHTTPTimeout}),
	)
	return apptemplates.NewService(
		localStore,
		remoteStore,
		cacheStore,
		platformtime.SystemClock{},
		apptemplates.WithDispatcher(dispatcher),
	), nil
}
