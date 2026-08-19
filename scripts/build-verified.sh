#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
wrangler="${SITES_PROJECT_ROOT}/node_modules/.bin/wrangler"

if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

# Production Cloudflare builds need the durable audiobook bucket before Wrangler
# validates the R2 binding. Local/verification builds skip this because they do
# not carry Cloudflare credentials.
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" && -x "${wrangler}" ]]; then
  bucket="mafateeh-al-tharwa-audio"
  echo "Ensuring R2 bucket ${bucket} exists..."
  if ! "${wrangler}" r2 bucket create "${bucket}" >/tmp/mafateeh-r2-create.log 2>&1; then
    if ! "${wrangler}" r2 bucket list 2>/dev/null | grep -Fq "${bucket}"; then
      cat /tmp/mafateeh-r2-create.log >&2 || true
      echo "Unable to create or verify R2 bucket ${bucket}." >&2
      exit 70
    fi
    echo "R2 bucket ${bucket} already exists."
  else
    echo "R2 bucket ${bucket} created."
  fi
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

bash "${script_dir}/validate-artifact.sh"
