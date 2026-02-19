set shell := ["bash", "-c"]

security-scan:
    trivy fs --config trivy.yaml .

security-scan-blocking:
    trivy fs --config trivy.yaml --exit-code 1 .

security-scan-sarif output="trivy-results.sarif":
    trivy fs --config trivy.yaml --format sarif --output {{output}} .

security-scan-secret:
    trivy fs --config trivy.yaml --scanners secret --secret-config trivy-secret.yaml --severity HIGH,CRITICAL .

security-scan-license:
    trivy fs --config trivy.yaml --scanners vuln,license --severity HIGH,CRITICAL .

security-scan-sbom output="trivy-sbom.cdx.json":
    trivy fs --config trivy.yaml --scanners vuln --format cyclonedx --output {{output}} .

security-scan-ci:
    if [ "${TRIVY_ENFORCE:-0}" = "1" ]; then \
      trivy fs --config trivy.yaml --format sarif --output trivy-results.sarif --exit-code 1 .; \
    else \
      trivy fs --config trivy.yaml --format sarif --output trivy-results.sarif --exit-code 0 .; \
    fi
