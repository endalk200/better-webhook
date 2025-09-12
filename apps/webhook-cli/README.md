# Better Webhook CLI

Simple CLI for listing, downloading, and executing predefined webhook JSON payloads stored in a local `.webhooks` directory.

## Install (workspace)

From repo root after cloning:

```bash
pnpm install
pnpm --filter @better-webhook/cli build
```

Run via pnpm:

```bash
pnpm --filter @better-webhook/cli exec better-webhook list
```

Or in dev (watch) mode:

```bash
pnpm --filter @better-webhook/cli dev run sample
```

## Install (published)

After publishing to npm you can use:

```bash
npx @better-webhook/cli list
# or (after global install)
pnpm add -g @better-webhook/cli
better-webhook list
```

The binary name is `better-webhook`.

## Publishing (maintainers)

1. Update version (pnpm):
   ```bash
   pnpm --filter @better-webhook/cli version patch   # or minor / major
   ```
2. Build & publish (ensure you are logged in with `npm whoami`):
   ```bash
   pnpm --filter @better-webhook/cli run build
   cd apps/webhook-cli
   npm publish --access public
   ```
   (The `prepublishOnly` script also builds/validates automatically.)
3. Test install:
   ```bash
   pnpm dlx @better-webhook/cli@latest --help
   ```

## Webhook File Schema

Every webhook JSON file MUST conform to this schema (validated with `zod`):

```jsonc
{
  "url": "https://example.com/endpoint", // required, valid URL
  "method": "POST", // optional, defaults to POST (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
  "headers": [
    // optional, defaults to []
    { "key": "X-Custom", "value": "abc" },
  ],
  "body": {
    // optional (omit for methods w/out body)
    "event": "user.created",
    "data": { "id": "123" },
  },
}
```

Validation errors list all failing fields with context.

## Directory Structure

```
./.webhooks/
  user_created.json
  order_paid.json
```

## Commands

### List

```
better-webhook list
```

Lists all JSON filenames (without extension) in `.webhooks`.

### Download Templates

```
better-webhook download                # lists available templates
better-webhook download stripe-invoice.payment_succeeded
better-webhook download --all
```

### Run

```
better-webhook run user_created
better-webhook run path/to/file.json
```

Overrides:

```
--url https://override.test/hook
--method PUT
```

### Examples

Minimal:

```json
{ "url": "https://example.com/hook" }
```

With headers + body:

```json
{
  "url": "https://example.com/hook",
  "method": "POST",
  "headers": [
    { "key": "X-Env", "value": "staging" },
    { "key": "Authorization", "value": "Bearer TOKEN" }
  ],
  "body": { "event": "deploy", "status": "ok" }
}
```

## Output

- Prints status code
- Prints response headers
- Pretty-prints JSON response or raw body

## Error Handling

- Invalid JSON -> fails with parse message
- Schema violations -> detailed list of issues
- Network errors -> reported with non-zero exit code

## Notes

- Content-Type automatically set to `application/json` if body present and not already specified.
- Headers defined later override earlier duplicates.
