#!/usr/bin/env bash
# ============================================================
# validate-2.20.sh — Checklist de validação local Sessão 2.20
# Executar a partir de: governa/
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE="$ROOT/infra/docker/docker-compose.yml"

echo "──────────────────────────────────────────────"
echo " governa — validação sessão 2.20"
echo "──────────────────────────────────────────────"

# 1. Subir apenas postgres + governa-gateway
echo ""
echo "[1] docker compose up (postgres + governa-gateway)..."
docker compose -f "$COMPOSE" up -d postgres governa-gateway

# 2. Aguardar healthcheck do gateway (máx 60s)
echo ""
echo "[2] Aguardando healthcheck do governa-gateway (máx 60s)..."
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' governa_gateway 2>/dev/null || echo "starting")
  echo "  tentativa $i/12 — status: $STATUS"
  if [ "$STATUS" = "healthy" ]; then
    echo "  ✅ governa_gateway healthy"
    break
  fi
  if [ $i -eq 12 ]; then
    echo "  ❌ timeout — ver logs: docker logs governa_gateway"
    exit 1
  fi
  sleep 5
done

# 3. Testar endpoint /health diretamente
echo ""
echo "[3] curl http://localhost:3100/health"
HEALTH=$(curl -sf http://localhost:3100/health)
echo "  resposta: $HEALTH"
if echo "$HEALTH" | grep -q '"status"'; then
  echo "  ✅ /health OK"
else
  echo "  ❌ /health não retornou { status: ... }"
  exit 1
fi

# 4. Verificar variáveis de ambiente dentro do container
echo ""
echo "[4] GATEWAY_BASE_URL em governa-core/.env (local)"
if [ -f "$ROOT/apps/governa-core/.env" ]; then
  GURL=$(grep '^GATEWAY_BASE_URL=' "$ROOT/apps/governa-core/.env" | cut -d= -f2-)
  echo "  GATEWAY_BASE_URL=$GURL"
  if [ "$GURL" = "http://localhost:3100" ]; then
    echo "  ✅ aponta para gateway local"
  else
    echo "  ⚠️  valor diferente do esperado (http://localhost:3100)"
  fi
else
  echo "  ⚠️  apps/governa-core/.env não existe — copie de .env.example e ajuste"
fi

# 5. Smoke test: iniciar governa-core localmente (dry-run de env)
echo ""
echo "[5] governa-core — validar leitura de GATEWAY_BASE_URL"
if [ -f "$ROOT/apps/governa-core/.env" ]; then
  VAL=$(cd "$ROOT/apps/governa-core" && node -e "
    require('dotenv').config();
    const v = process.env.GATEWAY_BASE_URL;
    if (!v) { console.error('GATEWAY_BASE_URL não definida'); process.exit(1); }
    console.log('GATEWAY_BASE_URL=' + v);
  " 2>&1)
  echo "  $VAL"
  if echo "$VAL" | grep -q 'GATEWAY_BASE_URL='; then
    echo "  ✅ governa-core lê GATEWAY_BASE_URL corretamente"
  else
    echo "  ❌ erro ao ler variável: $VAL"
  fi
else
  echo "  ⚠️  .env ausente — pulando smoke test"
fi

echo ""
echo "──────────────────────────────────────────────"
echo " Validação 2.20 concluída"
echo " Para derrubar: docker compose -f infra/docker/docker-compose.yml down"
echo "──────────────────────────────────────────────"
