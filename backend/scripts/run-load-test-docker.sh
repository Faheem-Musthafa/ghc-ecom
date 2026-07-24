#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL is required}"
: "${VARIANT_ID:?VARIANT_ID is required}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN is required}"
: "${RAZORPAY_WEBHOOK_SECRET:?RAZORPAY_WEBHOOK_SECRET is required}"

mkdir -p artifacts

docker run --rm \
  -i \
  -u "$(id -u):$(id -g)" \
  -v "$PWD/artifacts:/artifacts" \
  -e BASE_URL \
  -e VARIANT_ID \
  -e ADMIN_TOKEN \
  -e RAZORPAY_WEBHOOK_SECRET \
  -e DURATION \
  -e CATALOGUE_VUS \
  -e CHECKOUT_VUS \
  -e WEBHOOK_RPS \
  -e ADMIN_VUS \
  grafana/k6:latest run \
  --summary-export=/artifacts/k6-summary.json \
  - < test/load/ecommerce.js
