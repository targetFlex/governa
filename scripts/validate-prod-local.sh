#!/usr/bin/env bash
# Valida a stack de produção localmente (sem VPS/DNS/TLS).
# Builds locais de governa-core e governa-gateway, Traefik HTTP-only na :8088.
#
# Pré-requisito: stack de dev (docker-compose.yml) deve estar parada.
# Uso: bash scripts/validate-prod-local.sh [--no-teardown]
#
# --no-teardown: mantém a stack rodando após os testes (para inspeção manual)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra/docker"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod-local.yml"
ENV_FILE="$INFRA_DIR/.env.prod-local"
PROJECT="governa-local"
TIMEOUT=180
NO_TEARDOWN=false

for arg in "$@"; do
  [ "$arg" = "--no-teardown" ] && NO_TEARDOWN=true
done

compose() {
  docker compose -p "$PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

teardown() {
  echo ""
  echo "==> Parando stack..."
  compose down -v --remove-orphans 2>/dev/null || true
}

wait_healthy() {
  local container="$1"
  local elapsed=0
  while [ $elapsed -lt $TIMEOUT ]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
    case "$status" in
      healthy)    return 0 ;;
      unhealthy)  return 1 ;;
      not_found)  echo "  [$container] container não encontrado"; return 1 ;;
    esac
    echo "  [$container] $status... (${elapsed}s/${TIMEOUT}s)"
    sleep 10
    elapsed=$((elapsed + 10))
  done
  echo "  [$container] timeout"
  return 1
}

FAILED=0

echo "============================================================"
echo " AICOCKPIT — Validação local da stack de produção"
echo "============================================================"
echo ""

echo "==> Buildando e subindo a stack (pode levar ~2 min no primeiro build)..."
compose up -d --build

echo ""
echo "==> Aguardando serviços ficarem healthy..."
for container in governa_local_postgres governa_local_redis governa_local_gateway governa_local_core; do
  if wait_healthy "$container"; then
    echo "  ✓ $container: healthy"
  else
    echo "  ✗ $container: falhou"
    compose logs "$container" --tail=30 2>/dev/null || true
    FAILED=1
  fi
done

if [ $FAILED -eq 0 ]; then
  echo ""
  echo "==> Smoke tests..."

  # Teste via Traefik file provider (HTTP routing — Host: localhost)
  # NOTA: O Docker provider do Traefik v3.x não é compatível com Docker Desktop
  # 4.73+ (API 1.54) no macOS. Aqui usamos file provider estático, que é
  # equivalente funcionalmente. No VPS Linux, o Docker provider dos labels funciona.
  TRAEFIK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: localhost" \
    --max-time 5 \
    http://localhost:8088/health 2>/dev/null || echo "000")
  if [ "$TRAEFIK_STATUS" = "200" ]; then
    echo "  ✓ Traefik → governa-core /health (file provider): $TRAEFIK_STATUS"
  else
    echo "  ✗ Traefik → governa-core /health: $TRAEFIK_STATUS"
    FAILED=1
  fi

  # Verificar que governa-core responde ao /health diretamente no container
  CORE_DIRECT=$(docker exec governa_local_core \
    wget -q -O - http://localhost:3000/health 2>/dev/null || echo "FALHOU")
  if echo "$CORE_DIRECT" | grep -q "ok\|healthy\|status"; then
    echo "  ✓ governa-core /health direto: ok"
  else
    echo "  ✗ governa-core /health direto: falhou ($CORE_DIRECT)"
    FAILED=1
  fi

  # Verificar que governa-gateway responde ao /health diretamente no container
  GW_DIRECT=$(docker exec governa_local_gateway \
    wget -q -O - http://localhost:3100/health 2>/dev/null || echo "FALHOU")
  if echo "$GW_DIRECT" | grep -qv "FALHOU"; then
    echo "  ✓ governa-gateway /health direto: ok"
  else
    echo "  ✗ governa-gateway /health direto: falhou"
    FAILED=1
  fi

  # Verificar Traefik sem erros (file provider deve estar limpo)
  TRAEFIK_ERRS=$(docker logs governa_local_traefik 2>&1 | grep -c "ERR" || true)
  if [ "$TRAEFIK_ERRS" -eq 0 ]; then
    echo "  ✓ Traefik sem erros no log"
  else
    echo "  ! Traefik com $TRAEFIK_ERRS entradas ERR no log (verificar se crítico)"
  fi
fi

echo ""
echo "============================================================"
if [ $FAILED -eq 0 ]; then
  echo " RESULTADO: ✓ TODOS OS CHECKS PASSARAM"
else
  echo " RESULTADO: ✗ FALHAS DETECTADAS"
fi
echo "============================================================"

if [ "$NO_TEARDOWN" = "true" ]; then
  echo ""
  echo "Stack mantida rodando (--no-teardown)."
  echo "Para inspecionar: docker compose -p $PROJECT -f $COMPOSE_FILE --env-file $ENV_FILE ps"
  echo "Para derrubar:    docker compose -p $PROJECT -f $COMPOSE_FILE --env-file $ENV_FILE down -v"
else
  teardown
fi

exit $FAILED
