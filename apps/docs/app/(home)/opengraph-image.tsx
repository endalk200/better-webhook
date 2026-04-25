import { ImageResponse } from "next/og";
import { OGImage } from "@/lib/og-image";

export const alt = "better-webhook — Type-Safe Webhook SDK";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OGImage
        title="Type-Safe Webhook SDK"
        description="Type-safe webhooks in TypeScript with schema validation, signature verification, and framework adapters."
      />
    ),
    { ...size },
  );
}
