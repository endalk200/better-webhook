import {
  type WebhookBuilder,
  type ProcessResult,
  type WebhookObserver,
} from "@better-webhook/core";

// ============================================================================
// Types
// ============================================================================

/**
 * NestJS request interface (minimal)
 */
export interface NestJSRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: Buffer | string;
}

/**
 * Options for the NestJS adapter
 */
export interface NestJSAdapterOptions {
  /** Webhook secret for signature verification (overrides provider secret) */
  secret?: string;

  /** Callback invoked on successful webhook processing */
  onSuccess?: (eventType: string) => void | Promise<void>;

  /**
   * Observer(s) for webhook lifecycle events.
   * Use this to add observability without modifying the webhook builder.
   *
   * @example
   * ```ts
   * import { createWebhookStats } from '@better-webhook/core';
   *
   * const stats = createWebhookStats();
   *
   * const result = await toNestJS(this.webhook, {
   *   observer: stats.observer,
   * })(req);
   * ```
   */
  observer?: WebhookObserver | WebhookObserver[];
}

/**
 * NestJS handler result
 */
export interface NestJSResult {
  statusCode: number;
  body?: Record<string, unknown>;
}

/**
 * NestJS handler function type
 */
export type NestJSHandler = (req: NestJSRequest) => Promise<NestJSResult>;

// ============================================================================
// NestJS Adapter
// ============================================================================

/**
 * Convert a webhook builder to a NestJS request handler
 *
 * @important Requires raw body to be available on the request.
 * Configure NestJS to preserve raw body or use a route-specific raw parser.
 *
 * @example
 * ```ts
 * import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
 * import { Response } from 'express';
 * import { github } from '@better-webhook/github';
 * import { toNestJS } from '@better-webhook/nestjs';
 *
 * @Controller('webhooks')
 * export class WebhooksController {
 *   private webhook = github()
 *     .event('push', async (payload) => {
 *       console.log(`Push to ${payload.repository.name}`);
 *     });
 *
 *   @Post('github')
 *   async handleGitHub(@Req() req: any, @Res() res: Response) {
 *     const result = await toNestJS(this.webhook)(req);
 *     return res.status(result.statusCode).json(result.body);
 *   }
 * }
 * ```
 *
 * For raw body support, add this to your main.ts:
 * ```ts
 * import { NestFactory } from '@nestjs/core';
 * import { json } from 'express';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule, {
 *     rawBody: true, // Enable raw body
 *   });
 *   await app.listen(3000);
 * }
 * ```
 *
 * @param webhook - The webhook builder instance
 * @param options - Adapter options
 * @returns A function that processes the request and returns a result
 */
export function toNestJS<TProviderBrand extends string = string>(
  webhook: WebhookBuilder<TProviderBrand>,
  options?: NestJSAdapterOptions,
): NestJSHandler {
  // Apply observer(s) if provided
  const instrumentedWebhook = options?.observer
    ? webhook.observe(options.observer)
    : webhook;

  return async (req: NestJSRequest): Promise<NestJSResult> => {
    // Get raw body
    let rawBody: string | Buffer;

    if (req.rawBody) {
      // NestJS with rawBody: true option
      rawBody = req.rawBody;
    } else if (Buffer.isBuffer(req.body)) {
      // Body is already a Buffer
      rawBody = req.body;
    } else if (typeof req.body === "string") {
      // Body is a string
      rawBody = req.body;
    } else if (req.body && typeof req.body === "object") {
      // Body was parsed as JSON - stringify it back
      // Note: This may not preserve the exact original payload for signature verification
      try {
        rawBody = JSON.stringify(req.body);
      } catch {
        return {
          statusCode: 400,
          body: {
            ok: false,
            error:
              "Unable to process request body. Ensure raw body is available.",
          },
        };
      }
    } else {
      return {
        statusCode: 400,
        body: {
          ok: false,
          error: "Request body is required",
        },
      };
    }

    // Process the webhook
    const result: ProcessResult = await instrumentedWebhook.process({
      headers: req.headers,
      rawBody,
      secret: options?.secret,
    });

    // Call onSuccess if applicable
    if (result.status === 200 && result.eventType && options?.onSuccess) {
      try {
        await options.onSuccess(result.eventType);
      } catch {
        // Ignore errors from onSuccess callback
      }
    }

    // Return result
    if (result.status === 204) {
      return { statusCode: 204 };
    }

    return {
      statusCode: result.status,
      body: result.body || {
        ok: result.status === 200,
        eventType: result.eventType,
      },
    };
  };
}

// Re-export types for convenience
export type { ProcessResult };
