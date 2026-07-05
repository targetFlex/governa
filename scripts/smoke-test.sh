#!/usr/bin/env bash
# Smoke test pós-deploy do AICOCKPIT.
# Valida: redirect HTTP→HTTPS, TLS 1.3, /health 200, resposta correta.
#
# Uso: ./scripts/smoke-test.sh [domínio]
# Padrão: aicockpit.com.br
set -euo pipefail

DOMAIN="${1:-aicockpit.com.br}"
API_HOST="api.${DOMAIN}"
BASE="https://${API_HOST}"
TIMEOUT=10

PASS=0; FAIL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $*"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${NC} $*"; ((FAIL++)); }
info() { echo -e "  ${YELLOW}•${NC} $*"; }

echo ""
echo "Smoke test — ${BASE}"
echo "══════════════════════════════════════════════"

# ── 1. DNS resolve ────────────────────────────────
echo ""
echo "1. DNS"
IP=$(dig +short "${API_HOST}" A 2>/dev/null | head -1)
if [[ -n "$IP" ]]; then
  pass "api.${DOMAIN} → ${IP}"
else
  fail "api.${DOMAIN} não resolve — verifique os registros DNS"
fi

# ── 2. HTTP → HTTPS redirect ─────────────────────
echo ""
echo "2. Redirect HTTP → HTTPS"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time "$TIMEOUT" \
  "http://${API_HOST}/health" || echo "000")
case "$HTTP_STATUS" in
  301|302|307|308) pass "HTTP $HTTP_STATUS — redirecionamento correto" ;;
  000) fail "Sem resposta na porta 80 (timeout ou firewall)" ;;
  *)   fail "HTTP $HTTP_STATUS — esperado 3xx redirect" ;;
esac

# ── 3. HTTPS /health ─────────────────────────────
echo ""
echo "3. HTTPS /health"
RESPONSE=$(curl -s --max-time "$TIMEOUT" \
  --write-out "\n%{http_code}\n%{ssl_verify_result}" \
  "${BASE}/health" 2>/dev/null || echo -e "\n000\n1")

BODY=$(echo "$RESPONSE" | head -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -2 | head -1)
SSL_OK=$(echo "$RESPONSE" | tail -1)

if [[ "$HTTP_CODE" == "200" ]]; then
  pass "HTTP 200"
else
  fail "HTTP ${HTTP_CODE} — esperado 200"
fi

if [[ "$SSL_OK" == "0" ]]; then
  pass "Certificado TLS válido"
else
  info "Certificado staging (Let's Encrypt) — esperado até trocar ACME_CA_SERVER para produção"
fi

# ── 4. Resposta JSON correta ──────────────────────
echo ""
echo "4. Payload /health"
STATUS_FIELD=$(echo "$BODY" | jq -r '.status' 2>/dev/null || echo "parse_error")
TS_FIELD=$(echo "$BODY" | jq -r '.ts' 2>/dev/null || echo "")

if [[ "$STATUS_FIELD" == "ok" ]]; then
  pass "{ status: \"ok\" }"
else
  fail "Campo status ausente ou incorreto — body: $BODY"
fi

if [[ -n "$TS_FIELD" && "$TS_FIELD" != "null" ]]; then
  pass "{ ts: \"${TS_FIELD}\" }"
else
  fail "Campo ts ausente"
fi

# ── 5. TLS 1.3 ───────────────────────────────────
echo ""
echo "5. TLS versão mínima"
TLS_VERSION=$(curl -v --max-time "$TIMEOUT" "${BASE}/health" 2>&1 \
  | grep -i "TLSv\|SSL connection" | head -1 | grep -oP 'TLSv[\d.]+' || echo "desconhecido")
if [[ "$TLS_VERSION" == "TLSv1.3" ]]; then
  pass "TLS 1.3 negociado"
elif [[ "$TLS_VERSION" == "TLSv1.2" ]]; then
  fail "TLS 1.2 — verifique traefik-tls.yml (minVersion: VersionTLS13)"
else
  info "Versão TLS: ${TLS_VERSION} — verifique manualmente se necessário"
fi

# ── Resumo ────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}PASSOU ${PASS}/${TOTAL} verificações${NC}"
else
  echo -e "${RED}FALHOU ${FAIL}/${TOTAL} verificações${NC} — ${PASS} passaram"
fi
echo ""
[[ $FAIL -eq 0 ]]
