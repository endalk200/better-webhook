# bw

The `bw` binary is the Better Webhook CLI release vehicle for the new `2.x` line.

## Install

Stable channels:

```bash
brew install --cask endalk200/tap/better-webhook
npm install -g @better-webhook/cli
```

Prerelease testing:

```bash
npx @better-webhook/cli@next --version
npx @better-webhook/cli@2.0.0-alpha.1 version --json
```

Manual archive installs use the GitHub Release assets attached to `cli-v*` tags.

## Verify

```bash
bw --version
bw version --json
```

`bw --version` prints only the semantic version. `bw version --json` prints the machine-readable compatibility contract used by the release pipeline.
