#!/usr/bin/env bash
# Kept for backwards compatibility. The real, permanent fix is per-domain
# nginx server blocks + per-domain certificates, which scripts/vps-split-domain-vhosts.sh does.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SITE_DOMAINS="${SITE_DOMAINS:-${AD_DOMAINS:-breezysocial.com mefok.com skypq.com}}"
exec bash "$HERE/vps-split-domain-vhosts.sh"
