package init

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/runtime"
	"github.com/endalk200/better-webhook/apps/webhook-cli/internal/platform/ui"
)

type ConfigWriter interface {
	WriteDefaultConfig(configPath string, overwrite bool) (runtime.ConfigWriteResult, error)
}

type Dependencies struct {
	ConfigWriter ConfigWriter
}

func NewCommand(deps Dependencies) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Create a default CLI config file",
		Long: "Create a default config TOML file with documented settings.\n\n" +
			"Path precedence is: --config, " + runtime.EnvConfigPath + ", then ~/.better-webhook/config.toml.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if deps.ConfigWriter == nil {
				return errors.New("config writer cannot be nil")
			}
			force, err := cmd.Flags().GetBool("force")
			if err != nil {
				return err
			}
			resolvedPath, err := runtime.ResolveConfigPath(cmd)
			if err != nil {
				return err
			}
			writeResult, err := deps.ConfigWriter.WriteDefaultConfig(resolvedPath.Path, force)
			if err != nil {
				if errors.Is(err, runtime.ErrConfigFileAlreadyExists) {
					return fmt.Errorf("config file already exists at %q (use --force to overwrite)", resolvedPath.Path)
				}
				return err
			}

			if writeResult.Overwritten {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatSuccess("Overwrote config file."))
			} else {
				_, _ = fmt.Fprintln(cmd.OutOrStdout(), ui.FormatSuccess("Created default config file."))
			}
			_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s %s\n", ui.Bold.Render("Path"), ui.Info.Render(writeResult.Path))
			_, _ = fmt.Fprintf(
				cmd.OutOrStdout(),
				"%s\n",
				ui.Faint.Render("Tip: adjust values in the file or override with env vars/flags for one-off runs."),
			)
			return nil
		},
	}

	cmd.Flags().Bool("force", false, "Overwrite existing config file")
	return cmd
}
