import type { Request, Response } from "express";
import type { NestJSResult } from "@better-webhook/nestjs";

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export function writeNestResult(res: Response, result: NestJSResult): void {
  if (result.body !== undefined) {
    res.status(result.statusCode).json(result.body);
    return;
  }

  res.status(result.statusCode).end();
}

export function toNestRequest(req: RawBodyRequest) {
  return {
    headers: req.headers as Record<string, string | string[] | undefined>,
    body: req.body,
    rawBody: req.rawBody,
  };
}
