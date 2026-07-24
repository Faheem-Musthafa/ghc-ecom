#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_API_URL:?STAGING_API_URL is required}"

mkdir -p artifacts
openapi_url="${STAGING_API_URL%/}/api/v1/docs-json"

docker run --rm \
  -u "$(id -u):$(id -g)" \
  -v "$PWD/artifacts:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py \
  -t "$openapi_url" \
  -f openapi \
  -S \
  -J zap-api-report.json \
  -r zap-api-report.html \
  -I
