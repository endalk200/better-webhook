const endpoints = [
  ["GitHub", "/api/webhooks/github", ["push", "pull_request", "issues"]],
  [
    "Ragie",
    "/api/webhooks/ragie",
    ["document_status_updated", "connection_sync_finished", "entity_extracted"],
  ],
  [
    "Stripe",
    "/api/webhooks/stripe",
    ["charge.failed", "checkout.session.completed", "payment_intent.succeeded"],
  ],
  [
    "Recall",
    "/api/webhooks/recall",
    [
      "participant_events.join",
      "participant_events.chat_message",
      "transcript.data",
      "bot.done",
    ],
  ],
  [
    "Resend",
    "/api/webhooks/resend",
    [
      "email.delivered",
      "email.bounced",
      "email.received",
      "domain.updated",
      "contact.created",
    ],
  ],
] as const;

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Better Webhook Example Routes</h1>
      <p>
        This app keeps each provider in its own route file so you can see the
        consumer-side integration shape clearly.
      </p>

      <h2>Provider Routes</h2>
      <ul>
        {endpoints.map(([name, path, events]) => {
          return (
            <li key={path}>
              <strong>{name}</strong>: <code>POST {path}</code> and{" "}
              <code>GET {path}</code> with events {events.join(", ")}
            </li>
          );
        })}
      </ul>

      <h2>Recall Shape</h2>
      <p>
        Recall sends <code>{"{ event, data }"}</code>. The SDK routes on
        <code> body.event</code> and passes the unwrapped <code>body.data</code>
        to your handler. That payload still contains nested Recall fields such
        as
        <code> payload.data.participant</code> and{" "}
        <code>payload.data.code</code>.
      </p>

      <h2>Signed GitHub Test</h2>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
        }}
      >
        {`SECRET="your-github-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -X POST http://localhost:3002/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"`}
      </pre>
    </main>
  );
}
