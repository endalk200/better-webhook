import { Command } from "commander";
import chalk from "chalk";
import { startDashboardServer } from "../core/dashboard-server.js";

export const dashboard = new Command()
  .name("dashboard")
  .description("Start the local dashboard (UI + API + WebSocket) server")
  .option("-p, --port <port>", "Port to listen on", "4000")
  .option("-h, --host <host>", "Host to bind to", "localhost")
  .option("--capture-port <port>", "Capture server port", "3001")
  .option("--capture-host <host>", "Capture server host", "0.0.0.0")
  .option("--no-capture", "Do not start the capture server")
  .option("--captures-dir <dir>", "Override captures directory")
  .option("--templates-dir <dir>", "Override templates base directory")
  .action(async (options: any) => {
    const port = Number.parseInt(String(options.port), 10);
    if (!Number.isFinite(port) || port < 0 || port > 65535) {
      console.error(chalk.red("Invalid port number"));
      process.exitCode = 1;
      return;
    }

    try {
      const capturePort = Number.parseInt(String(options.capturePort), 10);
      if (
        !Number.isFinite(capturePort) ||
        capturePort < 0 ||
        capturePort > 65535
      ) {
        console.error(chalk.red("Invalid capture port number"));
        process.exitCode = 1;
        return;
      }

      const { url, server, capture } = await startDashboardServer({
        host: options.host,
        port,
        captureHost: options.captureHost,
        capturePort,
        startCapture: options.capture !== false,
        capturesDir: options.capturesDir,
        templatesBaseDir: options.templatesDir,
      });

      console.log(chalk.bold("\n🧭 Dashboard Server\n"));
      console.log(chalk.gray(`   Dashboard: ${url}/`));
      console.log(chalk.gray(`   Health: ${url}/health`));
      console.log(chalk.gray(`   API Base: ${url}/api`));
      console.log(
        chalk.gray(`   WebSocket: ${url.replace("http://", "ws://")}/ws`),
      );
      if (capture) {
        console.log();
        console.log(chalk.bold("🎣 Capture Server"));
        console.log(chalk.gray(`   Capture: ${capture.url}`));
        console.log(
          chalk.gray(
            `   Tip: Send webhooks to any path, e.g. ${capture.url}/webhooks/github`,
          ),
        );
      }
      console.log();

      const shutdown = async () => {
        if (capture) {
          await capture.server.stop();
        }
        await new Promise<void>((resolve) => server.close(() => resolve()));
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (error: any) {
      console.error(
        chalk.red(
          `Failed to start dashboard server: ${error?.message || error}`,
        ),
      );
      process.exitCode = 1;
    }
  });
