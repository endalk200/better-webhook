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
import { toNestJS } from "@better-webhook/nestjs";
import { createWebhookStats, type WebhookObserver } from "@better-webhook/core";

// Extend Request type to include rawBody
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

// Create stats collectors for observability
const githubStats = createWebhookStats();
const ragieStats = createWebhookStats();
const recallStats = createWebhookStats();
// Example-only manual dedupe cache: unbounded in-memory Set.
// For production, prefer withReplayProtection + createInMemoryReplayStore (or a shared persistent store).
const processedReplayKeys = new Set<string>();

function isDuplicateReplay(key: string | undefined): boolean {
  if (!key) {
    return false;
  }
  if (processedReplayKeys.has(key)) {
    return true;
  }
  processedReplayKeys.add(key);
  return false;
}

// Custom observer for logging webhook lifecycle events
const loggingObserver: WebhookObserver = {
  onRequestReceived: (event) => {
    console.log(
      `📥 [${event.provider}] Webhook received (${event.rawBodyBytes} bytes)`,
    );
  },
  onCompleted: (event) => {
    const status = event.success ? "✓" : "✗";
    console.log(
      `📊 [${event.provider}] ${status} Completed: status=${event.status}, duration=${event.durationMs.toFixed(2)}ms`,
    );
  },
  onVerificationFailed: (event) => {
    console.warn(`🔐 [${event.provider}] Verification failed: ${event.reason}`);
  },
  onHandlerFailed: (event) => {
    console.error(
      `💥 [${event.provider}] Handler ${event.handlerIndex} failed:`,
      event.error.message,
    );
  },
};

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
  // Create a GitHub webhook handler with observability
  private githubWebhook = github()
    .observe(githubStats.observer)
    .observe(loggingObserver)
    .event(push, async (payload, context) => {
      const replayKey = context.deliveryId
        ? `github:${context.deliveryId}`
        : undefined;
      if (isDuplicateReplay(replayKey)) {
        console.log("Duplicate GitHub delivery detected, skipping");
        return;
      }
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
    .observe(ragieStats.observer)
    .observe(loggingObserver)
    .event(document_status_updated, async (payload) => {
      const replayKey = payload.nonce ? `ragie:${payload.nonce}` : undefined;
      if (isDuplicateReplay(replayKey)) {
        console.log("Duplicate Ragie nonce detected, skipping");
        return;
      }
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
    .observe(recallStats.observer)
    .observe(loggingObserver)
    .event(participant_events_join, async (payload, context) => {
      const replayKey = context.deliveryId
        ? `recall:${context.deliveryId}`
        : undefined;
      if (isDuplicateReplay(replayKey)) {
        console.log("Duplicate Recall delivery detected, skipping");
        return;
      }
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

    if (result.body) {
      res.status(result.statusCode).json(result.body);
    } else {
      res.status(result.statusCode).end();
    }
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

    if (result.body) {
      res.status(result.statusCode).json(result.body);
    } else {
      res.status(result.statusCode).end();
    }
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

    if (result.body) {
      res.status(result.statusCode).json(result.body);
    } else {
      res.status(result.statusCode).end();
    }
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

  @Get("health")
  healthCheck(): object {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("stats")
  getStats(): object {
    return {
      github: githubStats.snapshot(),
      ragie: ragieStats.snapshot(),
      recall: recallStats.snapshot(),
      timestamp: new Date().toISOString(),
    };
  }
}
