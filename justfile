default:
    @just --list --unsorted

TRIVY_DB_REPO := "ghcr.io/aquasecurity/trivy-db:2"
TRIVY_JAVA_DB_REPO := "ghcr.io/aquasecurity/trivy-java-db:1"
TRIVY_SKIP_DB_UPDATE_VALUE := "true"
TRIVY_SKIP_JAVA_DB_UPDATE_VALUE := "true"

# Run configured lint commands for all packages and apps
lint:
    pnpm exec turbo run lint

# Run configured lint command for this package.
lint-package package:
    pnpm --filter {{ package }} run lint

# Run configured check-types commands for all packages and apps
check-types:
    pnpm exec turbo run check-types

# Run configured check-types command for this package.
check-types-package package:
    pnpm --filter {{ package }} run check-types

# Run configured test commands for all packages and apps
test:
    pnpm exec turbo run test

# Run configured test command for this package.
test-package package:
    pnpm --filter {{ package }} run test

# Run configured build commands for all packages and apps
build:
    pnpm exec turbo run build

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
    TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} trivy fs --config trivy.yaml .

security-scan-blocking:
    TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} trivy fs --config trivy.yaml --exit-code 1 .

security-scan-sarif output="trivy-results.sarif":
    TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} trivy fs --config trivy.yaml --format sarif --output {{ output }} .

security-scan-secret:
    TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} trivy fs --config trivy.yaml --scanners secret --secret-config trivy-secret.yaml --severity HIGH,CRITICAL .

security-scan-license:
    TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} trivy fs --config trivy.yaml --scanners vuln,license --severity HIGH,CRITICAL .

security-scan-sbom output="trivy-sbom.cdx.json":
    TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} trivy fs --config trivy.yaml --scanners vuln --format cyclonedx --output {{ output }} .

security-scan-ci:
    if [ "${TRIVY_ENFORCE:-0}" = "1" ]; then \
      TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} TRIVY_SKIP_DB_UPDATE="${TRIVY_SKIP_DB_UPDATE:-{{ TRIVY_SKIP_DB_UPDATE_VALUE }}}" TRIVY_SKIP_JAVA_DB_UPDATE="${TRIVY_SKIP_JAVA_DB_UPDATE:-{{ TRIVY_SKIP_JAVA_DB_UPDATE_VALUE }}}" trivy fs --config trivy.yaml --format sarif --output trivy-results.sarif --exit-code 1 .; \
    else \
      TRIVY_DB_REPOSITORY={{ TRIVY_DB_REPO }} TRIVY_JAVA_DB_REPOSITORY={{ TRIVY_JAVA_DB_REPO }} TRIVY_SKIP_DB_UPDATE="${TRIVY_SKIP_DB_UPDATE:-{{ TRIVY_SKIP_DB_UPDATE_VALUE }}}" TRIVY_SKIP_JAVA_DB_UPDATE="${TRIVY_SKIP_JAVA_DB_UPDATE:-{{ TRIVY_SKIP_JAVA_DB_UPDATE_VALUE }}}" trivy fs --config trivy.yaml --format sarif --output trivy-results.sarif --exit-code 0 .; \
    fi

changeset-check:
    tmp_file=$(mktemp); \
    err_file=$(mktemp); \
    base_ref="${CHANGESET_BASE_REF:-main}"; \
    if pnpm exec changeset status --output=json --since "$base_ref" > "$tmp_file" 2> "$err_file"; then \
      if ! releases_count=$(node -e "const fs=require('node:fs');const status=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(status.releases.length));" "$tmp_file" 2>> "$err_file"); then \
        echo "::error::Failed to parse changeset status JSON."; \
        cat "$err_file"; \
        rm -f "$tmp_file" "$err_file"; \
        exit 1; \
      fi; \
      case "$releases_count" in \
        ''|*[!0-9]*) \
          echo "::error::Invalid releases count parsed from changeset status: '$releases_count'"; \
          if [ -s "$err_file" ]; then cat "$err_file"; fi; \
          rm -f "$tmp_file" "$err_file"; \
          exit 1; \
          ;; \
        0) \
          echo "::warning::No changesets found. If this PR introduces user-facing changes, please add a changeset by running 'pnpm changeset'"; \
          echo "::notice::To add a changeset: 1) Run 'pnpm changeset' 2) Select packages to release 3) Choose version bump type 4) Write summary"; \
          ;; \
        *) \
          echo "✅ Changesets found - release will be triggered when merged"; \
          ;; \
      esac; \
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
