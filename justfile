default:
    @just --list --unsorted

TRIVY_DB_REPO := "ghcr.io/aquasecurity/trivy-db:2"
TRIVY_JAVA_DB_REPO := "ghcr.io/aquasecurity/trivy-java-db:1"
TRIVY_SKIP_DB_UPDATE_VALUE := "true"
TRIVY_SKIP_JAVA_DB_UPDATE_VALUE := "true"

# Run CLI release metadata tests.
cli-release-script-test:
    devbox run -- node --test scripts/cli-release.test.mjs

# Check formatting for the standalone Go CLI.
cli-format-check:
    devbox run -- zsh -lc 'files="$(cd {{ invocation_directory() }}/apps/cli && gofmt -l ./cmd ./internal ./main.go)"; if [ -n "$files" ]; then printf "%s\n" "$files"; exit 1; fi'

# Lint the standalone Go CLI.
cli-lint:
    devbox run -- zsh -lc 'cd {{ invocation_directory() }}/apps/cli && go vet ./...'

# Test the standalone Go CLI.
cli-test:
    devbox run -- zsh -lc 'cd {{ invocation_directory() }}/apps/cli && go test ./...'

# Build the standalone Go CLI with explicit release metadata.
cli-build version="dev" commit="unknown" date="unknown":
    devbox run -- zsh -lc 'cd {{ invocation_directory() }}/apps/cli && mkdir -p bin && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X github.com/endalk200/better-webhook/apps/cli/internal/version.Version={{ version }} -X github.com/endalk200/better-webhook/apps/cli/internal/version.Commit={{ commit }} -X github.com/endalk200/better-webhook/apps/cli/internal/version.Date={{ date }}" -o bin/bw .'

# Run a local GoReleaser CLI rehearsal from a tag-shaped version input.
release-cli tag="cli-v2.0.0-alpha.1" args="--snapshot --clean --skip=publish,announce,sign":
    zsh -lc 'cd {{ invocation_directory() }} && version="$$(node scripts/cli-release.mjs metadata --tag {{ tag }} --output github | grep "^version=" | cut -d= -f2-)"; test -n "$$version"; mkdir -p {{ invocation_directory() }}/.bin; GOBIN="{{ invocation_directory() }}/.bin" go install github.com/goreleaser/goreleaser/v2@v2.15.4; GOBIN="{{ invocation_directory() }}/.bin" go install github.com/anchore/syft/cmd/syft@v1.43.0; CLI_RELEASE_VERSION="$$version" PATH="{{ invocation_directory() }}/.bin:$$PATH" goreleaser release {{ args }} --config .goreleaser.yaml'

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
