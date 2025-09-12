import { z } from "zod";

// Allowed HTTP methods
export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

// Header entry schema
export const headerEntrySchema = z.object({
  key: z
    .string()
    .min(1, "Header key cannot be empty")
    .regex(/^[A-Za-z0-9-]+$/, {
      message: "Header key must contain only alphanumerics and -",
    }),
  value: z.string().min(1, "Header value cannot be empty"),
});

export const webhookSchema = z
  .object({
    url: z.string().url("Invalid URL"),
    method: httpMethodSchema.default("POST"),
    headers: z.array(headerEntrySchema).default([]),
    body: z.any().optional(), // could be anything JSON-serializable
  })
  .strict();

export type WebhookDefinition = z.infer<typeof webhookSchema>;

export function validateWebhookJSON(
  raw: unknown,
  source: string,
): WebhookDefinition {
  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid webhook definition in ${source}:\n${issues}`);
  }
  return parsed.data;
}
