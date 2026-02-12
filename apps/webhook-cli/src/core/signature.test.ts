import { describe, expect, it } from "vitest";
import {
  generateRecallSignature,
  generateSignature,
  getProviderHeaders,
} from "./signature.js";

describe("signature helpers", () => {
  describe("generateRecallSignature", () => {
    it("generates a v1 signature for Recall payloads", () => {
      const payload = '{"event":"transcript.data"}';
      const timestamp = 1731705121;
      const webhookId = "msg_test_123";
      const secret = "whsec_dGVzdC1yZWNhbGwtc2VjcmV0";

      const signature = generateRecallSignature(
        payload,
        secret,
        timestamp,
        webhookId,
      );

      expect(signature.header).toBe("Webhook-Signature");
      expect(signature.value).toBe(
        "v1,/Tpb01gdtwsQOKZ92HQ+9qzHEHG5ZxDXmPhaxPG4yFs=",
      );
    });

    it("throws when secret does not use whsec_ prefix", () => {
      expect(() =>
        generateRecallSignature(
          '{"event":"participant_events.join"}',
          "invalid-secret",
        ),
      ).toThrow(
        "Recall signature generation requires a secret with the whsec_ prefix",
      );
    });
  });

  describe("generateSignature", () => {
    it("generates Recall signature with provider dispatch", () => {
      const generated = generateSignature(
        "recall",
        '{"event":"bot.done"}',
        "whsec_dGVzdC1yZWNhbGwtc2VjcmV0",
        { timestamp: 1731705121, webhookId: "msg_test_456" },
      );

      expect(generated?.header).toBe("Webhook-Signature");
      expect(generated?.value).toBe(
        "v1,1S4uDLnwC3qN9n7rIcbvZeQpikXxcznCf/DzNCSEzXA=",
      );
    });
  });

  describe("getProviderHeaders", () => {
    it("returns Recall webhook id and timestamp headers", () => {
      const headers = getProviderHeaders("recall", {
        timestamp: 1731705121,
        webhookId: "msg_test_789",
      });

      expect(headers).toEqual(
        expect.arrayContaining([
          { key: "Content-Type", value: "application/json" },
          { key: "Webhook-Id", value: "msg_test_789" },
          { key: "Webhook-Timestamp", value: "1731705121" },
        ]),
      );
    });
  });
});
