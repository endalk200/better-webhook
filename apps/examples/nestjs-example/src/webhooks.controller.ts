import { Controller, Post, Get, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { github } from "@better-webhook/github";
import { push, pull_request, issues } from "@better-webhook/github/events";
import { recall } from "@better-webhook/recall";
import {
  bot_breakout_room_closed,
  bot_breakout_room_entered,
  bot_breakout_room_left,
  bot_breakout_room_opened,
  bot_call_ended,
  bot_done,
  bot_fatal,
  bot_in_call_not_recording,
  bot_in_call_recording,
  bot_in_waiting_room,
  bot_joining_call,
  bot_recording_permission_allowed,
  bot_recording_permission_denied,
  participant_events_chat_message,
  participant_events_join,
  participant_events_leave,
  participant_events_screenshare_off,
  participant_events_screenshare_on,
  participant_events_speech_off,
  participant_events_speech_on,
  participant_events_update,
  participant_events_webcam_off,
  participant_events_webcam_on,
  transcript_data,
  transcript_partial_data,
} from "@better-webhook/recall/events";
import { ragie } from "@better-webhook/ragie";
import {
  document_status_updated,
  connection_sync_finished,
  entity_extracted,
} from "@better-webhook/ragie/events";
import { stripe } from "@better-webhook/stripe";
import {
  charge_failed,
  checkout_session_completed,
  payment_intent_succeeded,
} from "@better-webhook/stripe/events";
import { toNestJS, type NestJSResult } from "@better-webhook/nestjs";
import { createInMemoryReplayStore } from "@better-webhook/core";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";

// Extend Request type to include rawBody
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const githubReplayStore = createInMemoryReplayStore();
const ragieReplayStore = createInMemoryReplayStore();
const stripeReplayStore = createInMemoryReplayStore();
const recallReplayStore = createInMemoryReplayStore();

const otelInstrumentation = createOpenTelemetryInstrumentation({
  includeEventTypeAttribute: true,
});

const logRecallParticipantEvent = async (
  payload: { data: { participant: { name: string | null } } },
  context: { eventType: string },
) => {
  console.log(
    `Recall ${context.eventType}: ${payload.data.participant.name ?? "unknown participant"}`,
  );
};

const logRecallBotCodeEvent = async (
  payload: { data: { code: string } },
  context: { eventType: string },
) => {
  console.log(`Recall ${context.eventType}: ${payload.data.code}`);
};

@Controller()
export class WebhooksController {
  private writeResponse(res: Response, result: NestJSResult): void {
    if (result.body !== undefined) {
      res.status(result.statusCode).json(result.body);
      return;
    }

    res.status(result.statusCode).end();
  }

  // Create a GitHub webhook handler with observability
  private githubWebhook = github()
    .instrument(otelInstrumentation)
    .withReplayProtection({ store: githubReplayStore })
    .event(push, async (payload, context) => {
      console.log("📦 Push event received!");
      console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
      console.log(`   Received at: ${context.receivedAt.toISOString()}`);
      console.log(`   Repository: ${payload.repository.full_name}`);
      console.log(`   Branch: ${payload.ref}`);
      console.log(`   Commits: ${payload.commits.length}`);
      payload.commits.forEach((commit) => {
        console.log(`   - ${commit.message} (${commit.id.slice(0, 7)})`);
      });
    })
    .event(pull_request, async (payload, context) => {
      console.log("🔀 Pull request event received!");
      console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
      console.log(`   Action: ${payload.action}`);
      console.log(
        `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
      );
      console.log(`   State: ${payload.pull_request.state}`);
    })
    .event(issues, async (payload, context) => {
      console.log("🎫 Issue event received!");
      console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
      console.log(`   Action: ${payload.action}`);
      console.log(`   Issue #${payload.issue.number}: ${payload.issue.title}`);
      console.log(`   State: ${payload.issue.state}`);
    })
    .onError(async (error, context) => {
      console.error("❌ Webhook error:", error.message);
      console.error("   Event type:", context.eventType);
    })
    .onVerificationFailed(async (reason) => {
      console.error("🔐 Verification failed:", reason);
    });

  // Create a Ragie webhook handler with observability
  private ragieWebhook = ragie()
    .instrument(otelInstrumentation)
    .withReplayProtection({ store: ragieReplayStore })
    .event(document_status_updated, async (payload) => {
      console.log("📄 Document status updated!");
      console.log(`   Document ID: ${payload.document_id}`);
      console.log(`   Status: ${payload.status}`);
      console.log(`   Partition: ${payload.partition}`);
    })
    .event(connection_sync_finished, async (payload) => {
      console.log("✅ Connection sync finished!");
      console.log(`   Connection ID: ${payload.connection_id}`);
      console.log(`   Sync ID: ${payload.sync_id}`);
      console.log(`   Partition: ${payload.partition}`);
    })
    .event(entity_extracted, async (payload) => {
      console.log("🔍 Entity extraction completed!");
      console.log(`   Document ID: ${payload.document_id}`);
      console.log(`   Partition: ${payload.partition}`);
    })
    .onError(async (error, context) => {
      console.error("❌ Ragie webhook error:", error.message);
      console.error("   Event type:", context.eventType);
    })
    .onVerificationFailed(async (reason) => {
      console.error("🔐 Ragie verification failed:", reason);
    });

  private recallWebhook = recall()
    .instrument(otelInstrumentation)
    .withReplayProtection({ store: recallReplayStore })
    .event(participant_events_join, async (payload, context) => {
      await logRecallParticipantEvent(payload, context);
    })
    .event(participant_events_leave, logRecallParticipantEvent)
    .event(participant_events_update, logRecallParticipantEvent)
    .event(participant_events_speech_on, logRecallParticipantEvent)
    .event(participant_events_speech_off, logRecallParticipantEvent)
    .event(participant_events_webcam_on, logRecallParticipantEvent)
    .event(participant_events_webcam_off, logRecallParticipantEvent)
    .event(participant_events_screenshare_on, logRecallParticipantEvent)
    .event(participant_events_screenshare_off, logRecallParticipantEvent)
    .event(participant_events_chat_message, async (payload, context) => {
      console.log(
        `Recall ${context.eventType}: ${payload.data.participant.name} -> ${payload.data.data.text}`,
      );
    })
    .event(transcript_data, async (payload, context) => {
      console.log(
        `Recall ${context.eventType}: words=${payload.data.words.length}`,
      );
    })
    .event(transcript_partial_data, async (payload, context) => {
      console.log(
        `Recall ${context.eventType}: words=${payload.data.words.length}`,
      );
    })
    .event(bot_joining_call, logRecallBotCodeEvent)
    .event(bot_in_waiting_room, logRecallBotCodeEvent)
    .event(bot_in_call_not_recording, logRecallBotCodeEvent)
    .event(bot_recording_permission_allowed, logRecallBotCodeEvent)
    .event(bot_recording_permission_denied, logRecallBotCodeEvent)
    .event(bot_in_call_recording, logRecallBotCodeEvent)
    .event(bot_call_ended, logRecallBotCodeEvent)
    .event(bot_done, logRecallBotCodeEvent)
    .event(bot_fatal, logRecallBotCodeEvent)
    .event(bot_breakout_room_entered, logRecallBotCodeEvent)
    .event(bot_breakout_room_left, logRecallBotCodeEvent)
    .event(bot_breakout_room_opened, logRecallBotCodeEvent)
    .event(bot_breakout_room_closed, logRecallBotCodeEvent)
    .onError(async (error, context) => {
      console.error("❌ Recall webhook error:", error.message);
      console.error("   Event type:", context.eventType);
    })
    .onVerificationFailed(async (reason) => {
      console.error("🔐 Recall verification failed:", reason);
    });

  private stripeWebhook = stripe()
    .instrument(otelInstrumentation)
    .withReplayProtection({ store: stripeReplayStore })
    .event(charge_failed, async (payload) => {
      console.log("💳 Stripe charge failed");
      console.log(`   Event ID: ${payload.id}`);
      console.log(`   Charge ID: ${payload.data.object.id}`);
      console.log(`   Amount: ${payload.data.object.amount}`);
      console.log(`   Failure: ${payload.data.object.failure_code}`);
    })
    .event(checkout_session_completed, async (payload) => {
      console.log("🧾 Stripe checkout session completed");
      console.log(`   Event ID: ${payload.id}`);
      console.log(`   Session ID: ${payload.data.object.id}`);
      console.log(`   Payment status: ${payload.data.object.payment_status}`);
    })
    .event(payment_intent_succeeded, async (payload) => {
      console.log("✅ Stripe payment intent succeeded");
      console.log(`   Event ID: ${payload.id}`);
      console.log(`   PaymentIntent ID: ${payload.data.object.id}`);
      console.log(`   Latest charge: ${payload.data.object.latest_charge}`);
    })
    .onError(async (error, context) => {
      console.error("❌ Stripe webhook error:", error.message);
      console.error("   Event type:", context.eventType);
    })
    .onVerificationFailed(async (reason) => {
      console.error("🔐 Stripe verification failed:", reason);
    });

  // Create the handlers with options
  private githubHandler = toNestJS(this.githubWebhook, {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed GitHub ${eventType} event`);
    },
  });

  private ragieHandler = toNestJS(this.ragieWebhook, {
    secret: process.env.RAGIE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Ragie ${eventType} event`);
    },
  });

  private recallHandler = toNestJS(this.recallWebhook, {
    secret: process.env.RECALL_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Recall ${eventType} event`);
    },
  });

  private stripeHandler = toNestJS(this.stripeWebhook, {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Stripe ${eventType} event`);
    },
  });

  @Post("webhooks/github")
  async handleGitHubWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.githubHandler({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
      rawBody: req.rawBody,
    });
    this.writeResponse(res, result);
  }

  @Get("webhooks/github")
  getGitHubWebhookInfo(): object {
    return {
      status: "ok",
      endpoint: "/webhooks/github",
      supportedEvents: ["push", "pull_request", "issues"],
    };
  }

  @Post("webhooks/ragie")
  async handleRagieWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.ragieHandler({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
      rawBody: req.rawBody,
    });
    this.writeResponse(res, result);
  }

  @Get("webhooks/ragie")
  getRagieWebhookInfo(): object {
    return {
      status: "ok",
      endpoint: "/webhooks/ragie",
      supportedEvents: [
        "document_status_updated",
        "document_deleted",
        "entity_extracted",
        "connection_sync_started",
        "connection_sync_progress",
        "connection_sync_finished",
        "connection_limit_exceeded",
        "partition_limit_exceeded",
      ],
    };
  }

  @Post("webhooks/recall")
  async handleRecallWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.recallHandler({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
      rawBody: req.rawBody,
    });
    this.writeResponse(res, result);
  }

  @Get("webhooks/recall")
  getRecallWebhookInfo(): object {
    return {
      status: "ok",
      endpoint: "/webhooks/recall",
      supportedEvents: [
        "participant_events.join",
        "participant_events.leave",
        "participant_events.update",
        "participant_events.speech_on",
        "participant_events.speech_off",
        "participant_events.webcam_on",
        "participant_events.webcam_off",
        "participant_events.screenshare_on",
        "participant_events.screenshare_off",
        "participant_events.chat_message",
        "transcript.data",
        "transcript.partial_data",
        "bot.joining_call",
        "bot.in_waiting_room",
        "bot.in_call_not_recording",
        "bot.recording_permission_allowed",
        "bot.recording_permission_denied",
        "bot.in_call_recording",
        "bot.call_ended",
        "bot.done",
        "bot.fatal",
        "bot.breakout_room_entered",
        "bot.breakout_room_left",
        "bot.breakout_room_opened",
        "bot.breakout_room_closed",
      ],
    };
  }

  @Post("webhooks/stripe")
  async handleStripeWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.stripeHandler({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
      rawBody: req.rawBody,
    });
    this.writeResponse(res, result);
  }

  @Get("webhooks/stripe")
  getStripeWebhookInfo(): object {
    return {
      status: "ok",
      endpoint: "/webhooks/stripe",
      supportedEvents: [
        "charge.failed",
        "checkout.session.completed",
        "payment_intent.succeeded",
      ],
    };
  }

  @Get("health")
  healthCheck(): object {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
