package capture

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/adapters/transport/httpcapture"
	appcapture "github.com/endalk200/better-webhook/apps/webhook-cli/internal/app/capture"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

type (
	ServiceFactory func(capturesDir string) (*appcapture.Service, error)
	ServerFactory  func(options httpcapture.ServerOptions) (*httpcapture.Server, error)
)

type Dependencies struct {
	ServiceFactory ServiceFactory
	ServerFactory  ServerFactory
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "capture",
		Short: "Start a server to capture incoming webhooks",
		RunE: func(cmd *cobra.Command, args []string) error {
			captureArgs, err := runtime.ResolveCaptureArgs(cmd)
			if err != nil {
				return err
			}

			captureService, err := deps.ServiceFactory(captureArgs.CapturesDir)
			if err != nil {
				return err
			}
			server, err := deps.ServerFactory(httpcapture.ServerOptions{
				Host:       captureArgs.Host,
				Port:       captureArgs.Port,
				Verbose:    captureArgs.Verbose,
				CaptureSvc: captureService,
			})
			if err != nil {
				return err
			}

			port, err := server.Start()
			if err != nil {
				return err
			}

			address := net.JoinHostPort(captureArgs.Host, strconv.Itoa(port))
			url := "http://" + address
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s %s\n", ui.Bold.Render("Listening on"), ui.Info.Render(url))
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s %s\n", ui.Bold.Render("Captures dir"), ui.Muted.Render(captureArgs.CapturesDir))
			_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.Faint.Render("Press Ctrl+C to stop"))

			baseCtx := cmd.Context()
			if baseCtx == nil {
				baseCtx = context.Background()
			}
			shutdownSignalCtx, stopSignal := signal.NotifyContext(baseCtx, os.Interrupt, syscall.SIGTERM)
			defer stopSignal()

			serveErrCh := make(chan error, 1)
			go func() {
				serveErrCh <- server.Wait()
			}()

			select {
			case <-shutdownSignalCtx.Done():
				shutdownCtx, cancel := context.WithTimeout(baseCtx, 5*time.Second)
				defer cancel()
				stopErr := server.Stop(shutdownCtx)
				waitErr := <-serveErrCh
				if stopErr != nil {
					return stopErr
				}
				if waitErr != nil && !errors.Is(waitErr, context.Canceled) {
					return waitErr
				}
				return nil
			case waitErr := <-serveErrCh:
				return waitErr
			}
		},
	}

	cmd.Flags().String("captures-dir", "", "Directory where captures are stored")
	cmd.Flags().String("host", runtime.DefaultCaptureHost, "Host to bind the capture server")
	cmd.Flags().IntP("port", "p", runtime.DefaultCapturePort, "Port to listen on")
	cmd.Flags().BoolP("verbose", "v", runtime.DefaultCaptureVerbose, "Enable verbose capture logging")

	return cmd
}
