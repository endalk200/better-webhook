export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Better Webhook - Next.js Example</h1>
      <p>
        This example demonstrates how to use <code>@better-webhook/github</code>{" "}
        with <code>@better-webhook/nextjs</code>.
      </p>

      <h2>Endpoints</h2>
      <ul>
        <li>
          <code>POST /api/webhooks/github</code> - GitHub webhook endpoint
        </li>
      </ul>

      <h2>Testing</h2>
      <p>
        Use the following curl command to test (without signature verification):
      </p>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
        }}
      >
        {`curl -X POST http://localhost:3002/api/webhooks/github \\
  -H "Content-Type: application/json" \\
  -H "X-GitHub-Event: push" \\
  -H "X-GitHub-Delivery: test-123" \\
  -d '{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'`}
      </pre>
    </main>
  );
}
