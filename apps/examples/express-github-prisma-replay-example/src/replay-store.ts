import { Prisma } from "@prisma/client";
import type { ReplayReserveResult, ReplayStore } from "@better-webhook/core";
import { prisma } from "./prisma.js";

export class PrismaReplayStore implements ReplayStore {
  async reserve(
    key: string,
    inFlightTtlSeconds: number,
  ): Promise<ReplayReserveResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + inFlightTtlSeconds * 1000);

    const inserted = await prisma.$executeRaw`
      INSERT INTO replay_records (key, expires_at, created_at, updated_at)
      VALUES (${key}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE
      SET expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      WHERE replay_records.expires_at <= ${now}
    `;

    return inserted > 0 ? "reserved" : "duplicate";
  }

  async commit(key: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await prisma.replayRecord.update({
      where: { key },
      data: { expiresAt },
    });
  }

  async release(key: string): Promise<void> {
    try {
      await prisma.replayRecord.delete({ where: { key } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return;
      }

      throw error;
    }
  }
}
