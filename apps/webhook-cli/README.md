# Better Webhook CLI

Simple CLI for listing and executing predefined webhook JSON payloads stored in a local `.webhooks` directory.

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
