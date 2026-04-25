default:
    @just --list --unsorted

TRIVY_DB_REPO := "ghcr.io/aquasecurity/trivy-db:2"
TRIVY_JAVA_DB_REPO := "ghcr.io/aquasecurity/trivy-java-db:1"
TRIVY_SKIP_DB_UPDATE_VALUE := "true"
TRIVY_SKIP_JAVA_DB_UPDATE_VALUE := "true"

# Run configured build command for this package.
build-package package:
    pnpm --filter {{ package }} run build

# Runs format:check for the go code using go tooling and format:check at the root level using prettier
format-check:
    # Run format:check at the root level using prettier
    pnpm run format:check

# Runs format:write for the go code using go tooling and format:write at the root level using prettier
format-write:
    # Run format:write at the root level using prettier
    pnpm run format:write

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
    node ./scripts/changeset-check.mjs
