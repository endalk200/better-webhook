default:
    @just --list --unsorted

# Run configured lint commands for all packages and apps
lint:
    turbo run lint

# Run configured lint command for this package.
lint-package package:
    pnpm --filter {{ package }} run lint

# Run configured check-types commands for all packages and apps
check-types:
    turbo run check-types

# Run configured check-types command for this package.
check-types-package package:
    pnpm --filter {{ package }} run check-types

# Run configured test commands for all packages and apps
test:
    turbo run test

# Run configured test command for this package.
test-package package:
    pnpm --filter {{ package }} run test

# Run configured build commands for all packages and apps
build:
    turbo run build

# Run configured build command for this package.
build-package package:
    pnpm --filter {{ package }} run build

# Runs format:check for the go code using go tooling and format:check at the root level using prettier
format-check:
    # Run format:check for the go code using go tooling
    pnpm --filter @better-webhook/cli-go run format:check
    # Run format:check at the root level using prettier
    pnpm run format:check

# Runs format:write for the go code using go tooling and format:write at the root level using prettier
format-write:
    # Run format:write for the go code using go tooling
    pnpm --filter @better-webhook/cli-go run format:write
    # Run format:write at the root level using prettier
    pnpm run format:write

# Install all dependencies for CI and local parity.
ci-install:
    pnpm install --frozen-lockfile

security-scan:
    TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 trivy fs --config trivy.yaml .

security-scan-blocking:
    TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 trivy fs --config trivy.yaml --exit-code 1 .

security-scan-sarif output="trivy-results.sarif":
    TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 trivy fs --config trivy.yaml --format sarif --output {{ output }} .

security-scan-secret:
    TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 trivy fs --config trivy.yaml --scanners secret --secret-config trivy-secret.yaml --severity HIGH,CRITICAL .

security-scan-license:
    TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 trivy fs --config trivy.yaml --scanners vuln,license --severity HIGH,CRITICAL .

security-scan-sbom output="trivy-sbom.cdx.json":
    TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 trivy fs --config trivy.yaml --scanners vuln --format cyclonedx --output {{ output }} .

security-scan-ci:
    if [ "${TRIVY_ENFORCE:-0}" = "1" ]; then \
      TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 TRIVY_SKIP_DB_UPDATE=true TRIVY_SKIP_JAVA_DB_UPDATE=true trivy fs --config trivy.yaml --format sarif --output trivy-results.sarif --exit-code 1 .; \
    else \
      TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1 TRIVY_SKIP_DB_UPDATE=true TRIVY_SKIP_JAVA_DB_UPDATE=true trivy fs --config trivy.yaml --format sarif --output trivy-results.sarif --exit-code 0 .; \
    fi

changeset-check:
    tmp_file=$(mktemp); \
    err_file=$(mktemp); \
    base_ref="${CHANGESET_BASE_REF:-main}"; \
    if pnpm exec changeset status --output=json --since "$base_ref" > "$tmp_file" 2> "$err_file"; then \
      releases_count=$(node -e "const fs=require('node:fs');const status=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(status.releases.length));" "$tmp_file"); \
      if [ "$releases_count" = "0" ]; then \
        echo "::warning::No changesets found. If this PR introduces user-facing changes, please add a changeset by running 'pnpm changeset'"; \
        echo "::notice::To add a changeset: 1) Run 'pnpm changeset' 2) Select packages to release 3) Choose version bump type 4) Write summary"; \
      else \
        echo "✅ Changesets found - release will be triggered when merged"; \
      fi; \
    else \
      err_text=$(tr '\n' ' ' < "$err_file"); \
      case "$err_text" in \
        *"Some packages have been changed but no changesets were found"*) \
          echo "::warning::No changesets found. If this PR introduces user-facing changes, please add a changeset by running 'pnpm changeset'"; \
          echo "::notice::To add a changeset: 1) Run 'pnpm changeset' 2) Select packages to release 3) Choose version bump type 4) Write summary"; \
          ;; \
        *) \
          echo "::error::Failed to run changeset status."; \
          cat "$err_file"; \
          rm -f "$tmp_file" "$err_file"; \
          exit 1; \
          ;; \
      esac; \
    fi; \
    rm -f "$tmp_file" "$err_file"
