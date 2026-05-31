# @better-webhook/cli

Beta implementation of the better-webhook v2 local webhook development CLI.

```sh
# project-local install
pnpm add -D @better-webhook/cli@beta
pnpm exec bw --version

# or global install
pnpm add -g @better-webhook/cli@beta
bw --version
```

The CLI is project-first. A directory-local project stores endpoint profiles, gateway settings, capture retention, and template run history in `.better-webhook/project.json`. Raw captures are stored locally under `.better-webhook/captures` by default.

## Commands

```sh
bw
bw --version
bw version
bw version --verbose
bw version --format json

bw init --name my-app

bw endpoint create \
  --id stripe-main \
  --mode provider \
  --provider stripe \
  --secret-env STRIPE_WEBHOOK_SECRET \
  --target http://127.0.0.1:3000/api/webhooks/stripe \
  --route /webhooks/stripe

bw endpoint list
bw endpoint show stripe-main
bw endpoint update --id stripe-main --target http://127.0.0.1:3000/webhook --route /webhooks/stripe
bw endpoint delete stripe-main --yes

bw templates update
bw templates update --catalog ./manifest.json --public-key <ed25519-public-key-hex>
bw templates list
bw templates search stripe
bw templates show stripe/payment_intent.succeeded
bw templates fork stripe/payment_intent.succeeded --name local/stripe-payment
bw templates run stripe/payment_intent.succeeded --endpoint stripe-main

bw dev

bw capture list
bw capture show cap_...
bw replay cap_...
bw replay cap_... --mode exact
```

Machine-readable mode is available on primary commands with `--format json`. Machine responses include a top-level `schemaVersion` field.

Endpoint targets are restricted to `localhost`, loopback IPs, private LAN IPs, `.local` hosts, and `host.docker.internal`. Public targets are rejected before delivery.

Provider-aware template execution and `local-verified` replay currently support Stripe and GitHub signing. Generic endpoints support capture, transparent forwarding, template delivery, and exact replay without claiming provider-aware verification guarantees.

Official templates are stored as visible JSONC files under the managed template home. The default location is the OS user config directory, and it can be overridden with `--template-home` or `BW_TEMPLATE_HOME`. Built-in official templates are checksum-verified before installation. External versioned catalogs require checksum verification for each template and Ed25519 manifest signature verification with `--public-key`. User-owned template forks are stored separately and are not overwritten by catalog updates.

## Release model

CLI releases are separate from SDK Changesets releases. Maintainers publish real CLI releases from annotated tags such as `cli/v2.0.0-beta.3`. Beta versions publish to the npm `beta` dist-tag and stable versions publish to `latest`.
