#!/usr/bin/env bash
# Deploy AICOCKPIT no VPS.
# Uso: ./scripts/deploy.sh [IMAGE_TAG]
# Requer: docker compose, infra/docker/.env preenchido
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra/docker"
IMAGE_TAG="${1:-latest}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

log "deploy — tag: $IMAGE_TAG"
cd "$INFRA_DIR"

export IMAGE_TAG

log "pulling images..."
docker compose -f docker-compose.prod.yml pull governa-core governa-gateway

log "starting services..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

log "waiting for governa-core to be healthy (max 120s)..."
if timeout 120 sh -c \
  'until [ "$(docker inspect --format "{{.State.Health.Status}}" governa_core 2>/dev/null)" = "healthy" ]; do sleep 5; done'; then
  log "governa-core healthy"
else
  log "ERROR: governa-core did not become healthy"
  docker compose -f docker-compose.prod.yml logs --tail=50 governa-core
  exit 1
fi

log "deploy complete"
docker compose -f docker-compose.prod.yml ps
