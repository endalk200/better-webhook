import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "undici";
import { CaptureServer } from "./capture-server.js";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("CaptureServer provider detection", () => {
  let capturesDir: string;
  let server: CaptureServer;
  let port: number;

  beforeEach(async () => {
    capturesDir = join(tmpdir(), `better-webhook-capture-test-${Date.now()}`);
    mkdirSync(capturesDir, { recursive: true });
    server = new CaptureServer({ capturesDir, enableWebSocket: false });
    port = await server.start(0, "127.0.0.1");
  });

  afterEach(async () => {
    await server.stop();
    rmSync(capturesDir, { recursive: true, force: true });
  });

  async function waitForCapturedProvider(): Promise<string | undefined> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const captures = server.listCaptures(1);
      const provider = captures[0]?.capture.provider;
      if (provider) {
        return provider;
      }
      await sleep(25);
    }
    return undefined;
  }

  it("detects Recall from webhook verification headers", async () => {
    const response = await request(`http://127.0.0.1:${port}/webhooks/recall`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": "msg_test_123",
        "webhook-timestamp": "1731705121",
        "webhook-signature": "v1,abc123",
      },
      body: JSON.stringify({
        event: "transcript.data",
        data: { data: { words: [] } },
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(await waitForCapturedProvider()).toBe("recall");
  });

  it("detects Recall from svix headers when event starts with bot.", async () => {
    const response = await request(`http://127.0.0.1:${port}/webhooks/recall`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": "msg_test_234",
        "svix-timestamp": "1731705121",
        "svix-signature": "v1,abc123",
      },
      body: JSON.stringify({
        event: "bot.done",
        data: { data: { code: "done", sub_code: null, updated_at: "now" } },
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(await waitForCapturedProvider()).toBe("recall");
  });
});
