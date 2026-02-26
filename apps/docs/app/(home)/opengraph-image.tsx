import { ImageResponse } from "next/og";
import { OGImage } from "@/lib/og-image";

export const alt = "better-webhook — Local-first Webhook Development Toolkit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OGImage
        title="Local-first Webhook Development Toolkit"
        description="Type-safe webhooks in TypeScript. Capture, replay, and test webhooks locally with a beautiful CLI and SDK."
      />
    ),
    { ...size },
  );
}
