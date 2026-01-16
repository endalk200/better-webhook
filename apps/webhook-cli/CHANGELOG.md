# @better-webhook/cli

## 3.5.0

### Minor Changes

- feat: ability to convert captures into templates

## 3.4.4

### Patch Changes

- fix: resolve path resolution issue

## 3.4.3

### Patch Changes

- Make sure CLI dashboard style matches documentation site theme

## 3.4.2

### Patch Changes

- Add observability to the core package, resolve nonce parsing issue with ragie provider and update docs

## 3.4.1

### Patch Changes

- Format readme and add badges

## 3.4.0

### Minor Changes

- Add deliveryId in context, fix dashboard UI issues and improve version inconsistencies

## 3.3.0

### Minor Changes

- Fix build asset resolution issue

## 3.2.0

### Minor Changes

- Include dashboard assets in main bundle

## 3.1.0

### Minor Changes

- Adds ragie provider and dashboard UI

## 3.0.0

### Major Changes

- Major refactor of the CLI codebase to improve readability, maintainability, and performance.
- Add new flags to the capture command to allow for custom port and host configuration.
- Add new flags to the replay command to allow for custom method and header configuration.
- Add new flags to the run command to allow for custom secret and header configuration.
- Add new flags to the templates command to allow for custom provider configuration.
- Add new flags to the captures command to allow for custom limit and provider configuration.

## 0.3.1

### Patch Changes

- Add better DX when working with webhooks run and replay commands

## 0.3.0

### Minor Changes

- Introduces a new webhook capture server feature and restructures the CLI command organization to improve usability and functionality. The main purpose is to enable local webhook development by providing the ability to capture incoming webhooks, replay them, and generate reusable templates from captured data.

## 0.2.0

### Minor Changes

- Initial release of the Better Webhook CLI with commands to scaffold and run webhook handlers,
