import type { Request, Response, NextFunction } from "express";
import {
  type WebhookBuilder,
  type ProcessResult,
  type WebhookObserver,
} from "@better-webhook/core";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the Express adapter
 */
export interface ExpressAdapterOptions {
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
   * app.post('/webhooks/github', express.raw({ type: 'application/json' }),
   *   toExpress(webhook, {
   *     observer: stats.observer,
   *   })
   * );
   * ```
   */
  observer?: WebhookObserver | WebhookObserver[];
}

/**
 * Express middleware type
 */
export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next?: NextFunction,
) => Promise<void>;

// ============================================================================
// Express Adapter
// ============================================================================

/**
 * Convert a webhook builder to an Express middleware
 *
 * @important Requires `express.raw({ type: 'application/json' })` middleware upstream
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { github } from '@better-webhook/github';
 * import { push } from '@better-webhook/github/events';
 * import { toExpress } from '@better-webhook/express';
 *
 * const app = express();
 *
 * const webhook = github()
 *   .event(push, async (payload) => {
 *     console.log(`Push to ${payload.repository.name}`);
 *   });
 *
 * app.post(
 *   '/webhooks/github',
 *   express.raw({ type: 'application/json' }),
 *   toExpress(webhook)
 * );
 * ```
 *
 * @param webhook - The webhook builder instance
 * @param options - Adapter options
 * @returns An Express middleware function
 */
export function toExpress<TProviderBrand extends string = string>(
  webhook: WebhookBuilder<TProviderBrand>,
  options?: ExpressAdapterOptions,
): ExpressMiddleware {
  // Apply observer(s) if provided
  const instrumentedWebhook = options?.observer
    ? webhook.observe(options.observer)
    : webhook;

  return async (
    req: Request,
    res: Response,
    next?: NextFunction,
  ): Promise<void> => {
    try {
      // Get raw body - expect Buffer from express.raw()
      let rawBody: string | Buffer;

      if (Buffer.isBuffer(req.body)) {
        rawBody = req.body;
      } else if (typeof req.body === "string") {
        rawBody = req.body;
      } else {
        // Body was already parsed as JSON - this is a configuration error
        res.status(400).json({
          ok: false,
          error:
            "Request body must be raw. Use express.raw({ type: 'application/json' }) middleware.",
        });
        return;
      }

      // Process the webhook
      const result: ProcessResult = await instrumentedWebhook.process({
        headers: req.headers as Record<string, string | undefined>,
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

      // Send response
      if (result.status === 204) {
        res.status(204).end();
        return;
      }

      res.status(result.status).json(
        result.body ?? {
          ok: result.status === 200,
          eventType: result.eventType,
        },
      );
    } catch (error) {
      // Pass to Express error handler if available
      if (next) {
        next(error);
      } else {
        res.status(500).json({
          ok: false,
          error: "Internal server error",
        });
      }
    }
  };
}

// Re-export types for convenience
export type { ProcessResult };
