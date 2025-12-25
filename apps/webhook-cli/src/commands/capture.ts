import { Command } from "commander";
import chalk from "chalk";
import { CaptureServer } from "../core/capture-server.js";

export const capture = new Command()
  .name("capture")
  .description("Start a server to capture incoming webhooks")
  .option("-p, --port <port>", "Port to listen on", "3001")
  .option("-h, --host <host>", "Host to bind to", "0.0.0.0")
  .action(async (options: { port: string; host: string }) => {
    const port = parseInt(options.port, 10);

    if (isNaN(port) || port < 0 || port > 65535) {
      console.error(chalk.red("Invalid port number"));
      process.exitCode = 1;
      return;
    }

    const server = new CaptureServer();

    try {
      await server.start(port, options.host);

      // Handle graceful shutdown
      const shutdown = async () => {
        await server.stop();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (error: any) {
      console.error(chalk.red(`Failed to start server: ${error.message}`));
      process.exitCode = 1;
    }
  });
