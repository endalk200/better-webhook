package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/packages/cli/internal/capture"
	"github.com/endalk200/better-webhook/packages/cli/internal/delivery"
	"github.com/endalk200/better-webhook/packages/cli/internal/domain"
	"github.com/endalk200/better-webhook/packages/cli/internal/gateway"
	"github.com/endalk200/better-webhook/packages/cli/internal/project"
	"github.com/endalk200/better-webhook/packages/cli/internal/provider"
	"github.com/endalk200/better-webhook/packages/cli/internal/replay"
	"github.com/endalk200/better-webhook/packages/cli/internal/templates"
)

type appOptions struct {
	format       string
	projectPath  string
	templateHome string
}

type machineEnvelope struct {
	SchemaVersion string `json:"schemaVersion"`
	Command       string `json:"command"`
	OK            bool   `json:"ok"`
	Data          any    `json:"data,omitempty"`
}

type machineErrorEnvelope struct {
	SchemaVersion string       `json:"schemaVersion"`
	OK            bool         `json:"ok"`
	Error         machineError `json:"error"`
}

type machineError struct {
	Message string `json:"message"`
}

func NewRootCommand(build BuildInfo) *cobra.Command {
	options := &appOptions{}
	cmd := &cobra.Command{
		Use:           "bw",
		Short:         "better-webhook local webhook development CLI",
		SilenceUsage:  true,
		SilenceErrors: true,
		Version:       fmt.Sprintf("bw version %s", build.Version),
		RunE: func(cmd *cobra.Command, _ []string) error {
			return cmd.Help()
		},
	}

	cmd.SetVersionTemplate("{{.Version}}\n")
	cmd.PersistentFlags().StringVar(&options.format, "format", "human", "output format: human or json")
	cmd.PersistentFlags().StringVar(&options.projectPath, "project", "", "project directory or config path for project-scoped commands")
	cmd.PersistentFlags().StringVar(&options.templateHome, "template-home", "", "override template storage directory")

	cmd.AddCommand(newVersionCommand(build))
	cmd.AddCommand(newInitCommand(options))
	cmd.AddCommand(newEndpointCommand(options))
	cmd.AddCommand(newTemplatesCommand(options))
	cmd.AddCommand(newCaptureCommand(options))
	cmd.AddCommand(newReplayCommand(options))
	cmd.AddCommand(newDevCommand(options))

	return cmd
}

func newVersionCommand(build BuildInfo) *cobra.Command {
	var verbose bool
	var localFormat string

	cmd := &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		RunE: func(cmd *cobra.Command, _ []string) error {
			format := localFormat
			if format == "" {
				format = "human"
			}
			out := cmd.OutOrStdout()
			return printVersion(out, build, versionOptions{
				format:  format,
				verbose: verbose,
			})
		},
	}

	cmd.Flags().StringVar(&localFormat, "format", "human", "output format: human or json")
	cmd.Flags().BoolVar(&verbose, "verbose", false, "print release metadata")

	return cmd
}

type versionOptions struct {
	format  string
	verbose bool
}

type versionOutput struct {
	SchemaVersion string `json:"schemaVersion"`
	Command       string `json:"command"`
	Version       string `json:"version"`
	Commit        string `json:"commit"`
	Date          string `json:"date"`
	BuiltBy       string `json:"builtBy"`
}

func printVersion(out io.Writer, build BuildInfo, opts versionOptions) error {
	switch opts.format {
	case "human":
		return printHumanVersion(out, build, opts.verbose)
	case "json":
		if opts.verbose {
			return fmt.Errorf("unsupported flag combination: --verbose only applies to human format")
		}
		return printJSONVersion(out, build)
	default:
		return fmt.Errorf("unsupported output format %q: expected human or json", opts.format)
	}
}

func printHumanVersion(out io.Writer, build BuildInfo, verbose bool) error {
	if !verbose {
		_, err := fmt.Fprintf(out, "bw version %s\n", build.Version)
		return err
	}

	_, err := fmt.Fprintf(
		out,
		"bw version %s\ncommit: %s\ndate: %s\nbuilt-by: %s\n",
		build.Version,
		build.Commit,
		build.Date,
		build.BuiltBy,
	)
	return err
}

func printJSONVersion(out io.Writer, build BuildInfo) error {
	encoder := json.NewEncoder(out)
	return encoder.Encode(versionOutput{
		SchemaVersion: domain.SchemaVersion,
		Command:       "version",
		Version:       build.Version,
		Commit:        build.Commit,
		Date:          build.Date,
		BuiltBy:       build.BuiltBy,
	})
}

func newInitCommand(options *appOptions) *cobra.Command {
	var name, directory, listenAddress, captureStore string
	var port, retentionDays int
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Create a directory-local better-webhook project",
		RunE: func(cmd *cobra.Command, _ []string) error {
			store := project.NewStore(project.Resolver{})
			resolved, err := store.Init(project.InitOptions{
				Directory:     directory,
				Name:          name,
				ListenAddress: listenAddress,
				Port:          port,
				CapturePath:   captureStore,
				RetentionDays: retentionDays,
				Now:           time.Now(),
			})
			if err != nil {
				return err
			}
			return render(cmd, options, "init", map[string]any{
				"projectRoot": resolved.Root,
				"configPath":  resolved.ConfigPath,
				"project":     resolved.Config,
			}, fmt.Sprintf("Initialized better-webhook project at %s\n", resolved.ConfigPath))
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "project name")
	cmd.Flags().StringVar(&directory, "dir", ".", "project directory")
	cmd.Flags().StringVar(&listenAddress, "listen", "127.0.0.1", "gateway listen address")
	cmd.Flags().IntVar(&port, "port", 4242, "gateway port")
	cmd.Flags().StringVar(&captureStore, "capture-store", "", "capture storage path")
	cmd.Flags().IntVar(&retentionDays, "retention-days", 7, "capture retention in days")
	return cmd
}

func newEndpointCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{Use: "endpoint", Short: "Manage endpoint profiles"}
	cmd.AddCommand(newEndpointCreateCommand(options, false))
	cmd.AddCommand(newEndpointCreateCommand(options, true))
	cmd.AddCommand(newEndpointListCommand(options))
	cmd.AddCommand(newEndpointShowCommand(options))
	cmd.AddCommand(newEndpointDeleteCommand(options))
	return cmd
}

func newEndpointCreateCommand(options *appOptions, update bool) *cobra.Command {
	var input project.EndpointInput
	var mode string
	use := "create"
	short := "Create an endpoint profile"
	if update {
		use = "update"
		short = "Update an endpoint profile"
	}
	cmd := &cobra.Command{
		Use:   use,
		Short: short,
		RunE: func(cmd *cobra.Command, _ []string) error {
			resolved, store, err := resolveProject(options)
			if err != nil {
				return err
			}
			input.Mode = domain.EndpointMode(mode)
			input.Now = time.Now()
			_, exists := project.EndpointByID(resolved.Config, input.ID)
			if update && !exists {
				return fmt.Errorf("endpoint %q did not exist; use bw endpoint create", input.ID)
			}
			if !update && exists {
				return fmt.Errorf("endpoint %q already exists; use bw endpoint update", input.ID)
			}
			next, endpoint, existed, err := store.UpsertEndpoint(resolved, input)
			if err != nil {
				return err
			}
			action := "Created"
			if existed {
				action = "Updated"
			}
			return render(cmd, options, "endpoint."+use, map[string]any{
				"projectRoot": next.Root,
				"endpoint":    endpoint,
				"updated":     existed,
			}, fmt.Sprintf("%s endpoint %s at route %s -> %s\n", action, endpoint.ID, endpoint.Route, endpoint.TargetURL))
		},
	}
	addEndpointFlags(cmd, &input, &mode)
	return cmd
}

func newEndpointListCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List endpoint profiles",
		RunE: func(cmd *cobra.Command, _ []string) error {
			resolved, _, err := resolveProject(options)
			if err != nil {
				return err
			}
			if options.format == "json" {
				return render(cmd, options, "endpoint.list", map[string]any{"endpoints": resolved.Config.Endpoints}, "")
			}
			out := cmd.OutOrStdout()
			if len(resolved.Config.Endpoints) == 0 {
				_, err := fmt.Fprintln(out, "No endpoints configured.")
				return err
			}
			for _, endpoint := range resolved.Config.Endpoints {
				providerName := endpoint.Provider
				if providerName == "" {
					providerName = "generic"
				}
				if _, err := fmt.Fprintf(out, "%s\t%s\t%s\t%s\n", endpoint.ID, providerName, endpoint.Route, endpoint.TargetURL); err != nil {
					return err
				}
			}
			return nil
		},
	}
	return cmd
}

func newEndpointShowCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show ENDPOINT_ID",
		Short: "Inspect one endpoint profile",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			resolved, _, err := resolveProject(options)
			if err != nil {
				return err
			}
			endpoint, ok := project.EndpointByID(resolved.Config, args[0])
			if !ok {
				return fmt.Errorf("endpoint %q not found", args[0])
			}
			return render(cmd, options, "endpoint.show", map[string]any{"endpoint": endpoint}, fmt.Sprintf("%s\n", mustJSON(endpoint)))
		},
	}
	return cmd
}

func newEndpointDeleteCommand(options *appOptions) *cobra.Command {
	var yes bool
	cmd := &cobra.Command{
		Use:   "delete ENDPOINT_ID",
		Short: "Delete an endpoint profile and its captures",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			resolved, store, err := resolveProject(options)
			if err != nil {
				return err
			}
			captureStore := capture.NewStore(resolved.Root, resolved.Config.Capture)
			captures, err := captureStore.List(args[0])
			if err != nil {
				return err
			}
			if len(captures) > 0 && !yes {
				return fmt.Errorf("endpoint %q has %d captures; rerun with --yes to delete the endpoint and related captures", args[0], len(captures))
			}
			next, endpoint, err := store.DeleteEndpoint(resolved, args[0])
			if err != nil {
				return err
			}
			deletedCaptures, err := captureStore.DeleteEndpointCaptures(args[0])
			if err != nil {
				return err
			}
			return render(cmd, options, "endpoint.delete", map[string]any{
				"projectRoot":     next.Root,
				"endpoint":        endpoint,
				"deletedCaptures": deletedCaptures,
			}, fmt.Sprintf("Deleted endpoint %s and %d captures\n", endpoint.ID, deletedCaptures))
		},
	}
	cmd.Flags().BoolVar(&yes, "yes", false, "confirm deletion when captures exist")
	return cmd
}

func newTemplatesCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{Use: "templates", Short: "Manage local webhook templates"}
	cmd.AddCommand(newTemplatesUpdateCommand(options))
	cmd.AddCommand(newTemplatesListCommand(options, false))
	cmd.AddCommand(newTemplatesListCommand(options, true))
	cmd.AddCommand(newTemplatesShowCommand(options))
	cmd.AddCommand(newTemplatesForkCommand(options))
	cmd.AddCommand(newTemplatesRunCommand(options))
	return cmd
}

func newTemplatesUpdateCommand(options *appOptions) *cobra.Command {
	var catalog, publicKey string
	cmd := &cobra.Command{
		Use:   "update",
		Short: "Install or update managed official templates",
		RunE: func(cmd *cobra.Command, _ []string) error {
			manager, err := templates.NewManager(options.templateHome)
			if err != nil {
				return err
			}
			var manifest templates.Manifest
			if catalog == "" {
				manifest, err = manager.InstallBuiltin()
			} else {
				manifest, err = manager.InstallFromManifest(catalog, publicKey)
			}
			if err != nil {
				return err
			}
			return render(cmd, options, "templates.update", map[string]any{"home": manager.Home, "manifest": manifest}, fmt.Sprintf("Installed %d official templates in %s\n", len(manifest.Templates), manager.Home))
		},
	}
	cmd.Flags().StringVar(&catalog, "catalog", "", "versioned catalog manifest URL or file path")
	cmd.Flags().StringVar(&publicKey, "public-key", "", "trusted Ed25519 public key hex for external catalog manifests")
	return cmd
}

func newTemplatesListCommand(options *appOptions, search bool) *cobra.Command {
	var query string
	use := "list"
	short := "List local templates"
	if search {
		use = "search QUERY"
		short = "Search local templates"
	}
	cmd := &cobra.Command{
		Use:   use,
		Short: short,
		RunE: func(cmd *cobra.Command, args []string) error {
			if search && len(args) > 0 {
				query = strings.Join(args, " ")
			}
			manager, err := templates.NewManager(options.templateHome)
			if err != nil {
				return err
			}
			items, err := manager.List(query)
			if err != nil {
				return err
			}
			if options.format == "json" {
				return render(cmd, options, "templates."+useCommandName(use), map[string]any{"templates": items, "home": manager.Home}, "")
			}
			out := cmd.OutOrStdout()
			for _, item := range items {
				providerName := item.Provider
				if providerName == "" {
					providerName = "generic"
				}
				if _, err := fmt.Fprintf(out, "%s\t%s\t%s\tverified=%t\n", item.ID, providerName, item.Source, item.VerificationCompatible); err != nil {
					return err
				}
			}
			return nil
		},
	}
	if !search {
		cmd.Flags().StringVar(&query, "query", "", "filter templates")
	}
	return cmd
}

func newTemplatesShowCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show TEMPLATE_ID",
		Short: "Inspect a template",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			manager, err := templates.NewManager(options.templateHome)
			if err != nil {
				return err
			}
			template, path, err := manager.Get(args[0])
			if err != nil {
				return err
			}
			return render(cmd, options, "templates.show", map[string]any{"template": template, "path": path}, fmt.Sprintf("%s\n", mustJSON(template)))
		},
	}
	return cmd
}

func newTemplatesForkCommand(options *appOptions) *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:   "fork TEMPLATE_ID",
		Short: "Create a user-owned copy of a managed template",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			manager, err := templates.NewManager(options.templateHome)
			if err != nil {
				return err
			}
			template, path, err := manager.Fork(args[0], name)
			if err != nil {
				return err
			}
			return render(cmd, options, "templates.fork", map[string]any{"template": template, "path": path}, fmt.Sprintf("Created user template %s at %s\n", template.ID, path))
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "new user template id")
	return cmd
}

func newTemplatesRunCommand(options *appOptions) *cobra.Command {
	var endpointID string
	cmd := &cobra.Command{
		Use:   "run TEMPLATE_ID",
		Short: "Run a template against a project endpoint",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			resolved, store, err := resolveProject(options)
			if err != nil {
				return err
			}
			endpoint, ok := project.EndpointByID(resolved.Config, endpointID)
			if !ok {
				return fmt.Errorf("endpoint %q not found", endpointID)
			}
			manager, err := templates.NewManager(options.templateHome)
			if err != nil {
				return err
			}
			template, _, err := manager.Get(args[0])
			if err != nil {
				return err
			}
			if err := ensureTemplateCompatible(endpoint, template); err != nil {
				return err
			}
			rendered := templates.Render(template, time.Now())
			headers := rendered.Headers
			registry := provider.NewRegistry()
			if endpoint.Mode == domain.EndpointModeProvider && template.VerificationCompatible {
				headers, err = registry.Sign(provider.SigningContext{
					Endpoint: endpoint,
					Body:     rendered.Body,
					Headers:  headers,
				})
				if err != nil {
					return err
				}
			}
			targetURL, err := delivery.URLWithRequestTarget(endpoint.TargetURL, rendered.Path, rendered.Query)
			if err != nil {
				return err
			}
			result := delivery.Client{}.Send(cmd.Context(), delivery.Request{
				Method:  rendered.Method,
				URL:     targetURL,
				Headers: headers,
				Body:    rendered.Body,
			})
			resolved.Config.TemplateRunHistory = append(resolved.Config.TemplateRunHistory, domain.TemplateRun{
				TemplateID:      template.ID,
				TemplateSource:  template.Source,
				CatalogVersion:  template.CatalogVersion,
				TemplateVersion: template.Version,
				EndpointID:      endpoint.ID,
				Provider:        endpoint.Provider,
				RunAt:           domain.NowString(time.Now()),
			})
			if err := store.Save(resolved); err != nil {
				return err
			}
			return render(cmd, options, "templates.run", map[string]any{
				"template": template.ID,
				"endpoint": endpoint.ID,
				"delivery": result,
			}, fmt.Sprintf("Sent template %s to endpoint %s: status=%d target=%s\n", template.ID, endpoint.ID, result.StatusCode, result.TargetURL))
		},
	}
	cmd.Flags().StringVar(&endpointID, "endpoint", "", "endpoint id to target")
	_ = cmd.MarkFlagRequired("endpoint")
	return cmd
}

func newCaptureCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{Use: "capture", Short: "Inspect captured webhook deliveries"}
	cmd.AddCommand(newCaptureListCommand(options))
	cmd.AddCommand(newCaptureShowCommand(options))
	cmd.AddCommand(newCaptureDeleteCommand(options))
	return cmd
}

func newCaptureListCommand(options *appOptions) *cobra.Command {
	var endpointID string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List captures",
		RunE: func(cmd *cobra.Command, _ []string) error {
			resolved, _, err := resolveProject(options)
			if err != nil {
				return err
			}
			store := capture.NewStore(resolved.Root, resolved.Config.Capture)
			captures, err := store.List(endpointID)
			if err != nil {
				return err
			}
			if options.format == "json" {
				return render(cmd, options, "capture.list", map[string]any{"captures": captures}, "")
			}
			out := cmd.OutOrStdout()
			for _, item := range captures {
				if _, err := fmt.Fprintf(out, "%s\t%s\t%s\t%s\n", item.ID, item.EndpointID, item.Request.Method, item.CapturedAt); err != nil {
					return err
				}
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&endpointID, "endpoint", "", "filter by endpoint id")
	return cmd
}

func newCaptureShowCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show CAPTURE_ID",
		Short: "Inspect a capture",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			resolved, _, err := resolveProject(options)
			if err != nil {
				return err
			}
			store := capture.NewStore(resolved.Root, resolved.Config.Capture)
			item, err := store.Load(args[0])
			if err != nil {
				return err
			}
			return render(cmd, options, "capture.show", map[string]any{"capture": item}, fmt.Sprintf("%s\n", mustJSON(item)))
		},
	}
	return cmd
}

func newCaptureDeleteCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete CAPTURE_ID",
		Short: "Delete a capture",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			resolved, _, err := resolveProject(options)
			if err != nil {
				return err
			}
			store := capture.NewStore(resolved.Root, resolved.Config.Capture)
			if err := store.Delete(args[0]); err != nil {
				return err
			}
			return render(cmd, options, "capture.delete", map[string]any{"captureId": args[0]}, fmt.Sprintf("Deleted capture %s\n", args[0]))
		},
	}
	return cmd
}

func newReplayCommand(options *appOptions) *cobra.Command {
	var mode string
	cmd := &cobra.Command{
		Use:   "replay CAPTURE_ID",
		Short: "Replay a captured delivery to its original endpoint",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			resolved, _, err := resolveProject(options)
			if err != nil {
				return err
			}
			captureStore := capture.NewStore(resolved.Root, resolved.Config.Capture)
			item, err := captureStore.Load(args[0])
			if err != nil {
				return err
			}
			endpoint, ok := project.EndpointByID(resolved.Config, item.EndpointID)
			if !ok {
				return fmt.Errorf("capture %q references missing endpoint %q", item.ID, item.EndpointID)
			}
			engine := replay.Engine{Delivery: delivery.Client{}, Providers: provider.NewRegistry()}
			result, err := engine.Replay(cmd.Context(), endpoint, item, domain.ReplayMode(mode))
			if err != nil {
				return err
			}
			return render(cmd, options, "replay", result, fmt.Sprintf("Replayed %s with mode %s: status=%d target=%s\n", item.ID, result.Mode, result.Delivery.StatusCode, result.Delivery.TargetURL))
		},
	}
	cmd.Flags().StringVar(&mode, "mode", "", "replay mode: exact or local-verified")
	return cmd
}

func newDevCommand(options *appOptions) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "dev",
		Short: "Run the project capture gateway",
		RunE: func(cmd *cobra.Command, _ []string) error {
			resolved, _, err := resolveProject(options)
			if err != nil {
				return err
			}
			if len(resolved.Config.Endpoints) == 0 {
				return fmt.Errorf("bw dev requires at least one endpoint profile")
			}
			captureStore := capture.NewStore(resolved.Root, resolved.Config.Capture)
			if _, err := captureStore.Prune(resolved.Config.Capture.RetentionDays, time.Now()); err != nil {
				return err
			}
			out := cmd.OutOrStdout()
			if options.format == "json" {
				if err := render(cmd, options, "dev.start", map[string]any{
					"listenAddress": resolved.Config.Gateway.ListenAddress,
					"port":          resolved.Config.Gateway.Port,
					"endpoints":     resolved.Config.Endpoints,
				}, ""); err != nil {
					return err
				}
			} else {
				if _, err := fmt.Fprintf(out, "Starting gateway on %s:%d for %d endpoints\n", resolved.Config.Gateway.ListenAddress, resolved.Config.Gateway.Port, len(resolved.Config.Endpoints)); err != nil {
					return err
				}
				if _, err := fmt.Fprintln(out, "Captures may contain sensitive data and are stored locally."); err != nil {
					return err
				}
			}
			server := gateway.Server{
				Project:    resolved,
				Captures:   captureStore,
				HTTPClient: &http.Client{Timeout: 30 * time.Second},
			}
			return server.ListenAndServe(cmd.Context())
		},
	}
	return cmd
}

func addEndpointFlags(cmd *cobra.Command, input *project.EndpointInput, mode *string) {
	cmd.Flags().StringVar(&input.ID, "id", "", "endpoint id")
	cmd.Flags().StringVar(mode, "mode", string(domain.EndpointModeGeneric), "endpoint mode: generic or provider")
	cmd.Flags().StringVar(&input.Provider, "provider", "", "provider name for provider-aware endpoints")
	cmd.Flags().StringVar(&input.TargetURL, "target", "", "local target URL")
	cmd.Flags().StringVar(&input.Route, "route", "", "explicit inbound gateway route")
	cmd.Flags().StringVar(&input.SecretEnv, "secret-env", "", "environment variable containing the Provider Secret")
	_ = cmd.MarkFlagRequired("id")
	_ = cmd.MarkFlagRequired("target")
	_ = cmd.MarkFlagRequired("route")
}

func resolveProject(options *appOptions) (project.ResolvedProject, project.Store, error) {
	store := project.NewStore(project.Resolver{})
	resolved, err := store.Resolve(".", options.projectPath)
	return resolved, store, err
}

func render(cmd *cobra.Command, options *appOptions, command string, data any, human string) error {
	switch options.format {
	case "human", "":
		if human == "" {
			human = fmt.Sprintf("%s\n", mustJSON(data))
		}
		_, err := io.WriteString(cmd.OutOrStdout(), human)
		return err
	case "json":
		encoder := json.NewEncoder(cmd.OutOrStdout())
		return encoder.Encode(machineEnvelope{
			SchemaVersion: domain.SchemaVersion,
			Command:       command,
			OK:            true,
			Data:          data,
		})
	default:
		return fmt.Errorf("unsupported output format %q: expected human or json", options.format)
	}
}

func ArgsRequestJSON(args []string) bool {
	requested := false
	for i, arg := range args {
		if arg == "--" {
			return requested
		}
		if arg == "--format" {
			requested = i+1 < len(args) && args[i+1] == "json"
			continue
		}
		if strings.HasPrefix(arg, "--format=") {
			requested = strings.TrimPrefix(arg, "--format=") == "json"
		}
	}
	return requested
}

func PrintMachineError(out io.Writer, err error) error {
	encoder := json.NewEncoder(out)
	return encoder.Encode(machineErrorEnvelope{
		SchemaVersion: domain.SchemaVersion,
		OK:            false,
		Error: machineError{
			Message: err.Error(),
		},
	})
}

func ensureTemplateCompatible(endpoint domain.EndpointProfile, template templates.Template) error {
	if endpoint.Mode == domain.EndpointModeGeneric {
		return nil
	}
	if template.Provider == "" {
		return fmt.Errorf("provider-aware endpoint %q requires a provider-compatible template", endpoint.ID)
	}
	if !strings.EqualFold(template.Provider, endpoint.Provider) {
		return fmt.Errorf("template %q is for provider %q and cannot target endpoint %q for provider %q", template.ID, template.Provider, endpoint.ID, endpoint.Provider)
	}
	if template.VerificationCompatible {
		if _, ok := provider.NewRegistry().Capabilities(endpoint.Provider); !ok {
			return fmt.Errorf("provider %q does not support verification-compatible template execution", endpoint.Provider)
		}
	}
	return nil
}

func mustJSON(value any) string {
	data, err := json.MarshalIndent(value, "", "\t")
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(data)
}

func useCommandName(use string) string {
	return strings.Fields(use)[0]
}
