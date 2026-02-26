import type { ReactElement } from "react";

const COLORS = {
  cream: "#faf8f4",
  black: "#1a1a1a",
  coral: "#ff5c38",
  textMuted: "#666666",
};

interface OGImageProps {
  title: string;
  description?: string;
  site?: string;
}

export function OGImage({
  title,
  description,
  site = "better-webhook",
}: OGImageProps): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px",
        backgroundColor: COLORS.cream,
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              backgroundColor: COLORS.coral,
              border: `3px solid ${COLORS.black}`,
              boxShadow: `4px 4px 0 ${COLORS.black}`,
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: 700,
              fontFamily: "monospace",
            }}
          >
            {">_"}
          </div>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: COLORS.black,
              fontFamily: "monospace",
            }}
          >
            {site}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginTop: "20px",
          }}
        >
          <h1
            style={{
              fontSize: "52px",
              fontWeight: 700,
              color: COLORS.black,
              lineHeight: 1.15,
              fontFamily: "monospace",
              margin: 0,
            }}
          >
            {title}
          </h1>

          {description ? (
            <p
              style={{
                fontSize: "24px",
                color: COLORS.textMuted,
                lineHeight: 1.4,
                fontFamily: "monospace",
                margin: 0,
                maxWidth: "900px",
              }}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "18px",
            color: COLORS.textMuted,
            fontFamily: "monospace",
          }}
        >
          <span>better-webhook.com</span>
        </div>

        <div
          style={{
            display: "flex",
            height: "6px",
            width: "200px",
            backgroundColor: COLORS.coral,
            border: `2px solid ${COLORS.black}`,
          }}
        />
      </div>
    </div>
  );
}
