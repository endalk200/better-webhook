# @better-webhook/cli

Initial beta scaffold for the better-webhook v2 command line interface.

```sh
pnpm add -D @better-webhook/cli@beta
bw --version
```

This beta intentionally includes only root help behavior and version reporting. Project, gateway, template, capture, and replay commands are not included yet.

## Commands

```sh
bw
bw --version
bw version
bw version --verbose
```

## Release model

CLI releases are separate from SDK Changesets releases. Maintainers publish real CLI releases from annotated tags such as `cli/v2.0.0-beta.1`. Beta versions publish to the npm `beta` dist-tag and stable versions publish to `latest`.
