#!/usr/bin/env bash
# Provisiona o VPS para o AICOCKPIT (governa).
# Execute no servidor como root logo após o primeiro login.
#
# Uso: bash <(curl -fsSL https://raw.githubusercontent.com/targetFlex/governa/main/scripts/provision-vps.sh)
# Ou copie e execute diretamente no servidor.
#
# O que este script faz:
#   1. Atualiza pacotes e instala dependências (Docker, git, jq, openssl)
#   2. Clona o repositório em /opt/governa
#   3. Gera secrets fortes (postgres, redis, jwt, pii_hmac) automaticamente
#   4. Cria /opt/governa/infra/docker/.env interativamente
#   5. Valida que todos os campos obrigatórios estão preenchidos
set -euo pipefail

REPO_URL="https://github.com/targetFlex/governa.git"
INSTALL_DIR="/opt/governa"
ENV_FILE="$INSTALL_DIR/infra/docker/.env"
ENV_EXAMPLE="$INSTALL_DIR/infra/docker/.env.production.example"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[provision]${NC} $*"; }
warn() { echo -e "${YELLOW}[aviso]${NC} $*"; }
err()  { echo -e "${RED}[erro]${NC} $*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Execute como root: sudo bash $0"
    exit 1
  fi
}

install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker já instalado: $(docker --version)"
    return
  fi
  log "Instalando Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  log "Docker instalado: $(docker --version)"
}

install_deps() {
  log "Instalando dependências (git, jq, openssl)..."
  apt-get update -qq
  apt-get install -y -qq git jq openssl curl
}

clone_repo() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "Repositório já existe em $INSTALL_DIR — atualizando..."
    git -C "$INSTALL_DIR" pull origin main
    return
  fi
  log "Clonando repositório em $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
}

gen_secret() {
  local len="${1:-64}"
  openssl rand -base64 "$len" | tr -d '\n/'
}

prompt() {
  local label="$1" var="$2" default="${3:-}"
  if [[ -n "$default" ]]; then
    read -rp "  $label [$default]: " val
    echo "${val:-$default}"
  else
    read -rp "  $label: " val
    while [[ -z "$val" ]]; do
      read -rp "  (obrigatório) $label: " val
    done
    echo "$val"
  fi
}

create_env() {
  if [[ -f "$ENV_FILE" ]]; then
    warn ".env já existe em $ENV_FILE"
    read -rp "  Sobrescrever? [s/N] " resp
    [[ "$resp" =~ ^[sS]$ ]] || { log "Mantendo .env existente."; return; }
  fi

  log "Gerando secrets aleatórios..."
  POSTGRES_PASSWORD=$(gen_secret 32)
  REDIS_PASSWORD=$(gen_secret 32)
  JWT_SECRET=$(gen_secret 64)
  PII_HMAC_SECRET=$(gen_secret 32)

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " Configure as variáveis de produção (Enter = usar padrão)"
  echo "═══════════════════════════════════════════════════════════════"
  DOMAIN=$(prompt "Domínio (ex: aicockpit.com.br)" DOMAIN "aicockpit.com.br")
  ACME_EMAIL=$(prompt "E-mail Let's Encrypt" ACME_EMAIL "admin@${DOMAIN}")
  IMAGE_OWNER=$(prompt "GitHub username/org (dono das imagens GHCR)" IMAGE_OWNER "targetFlex")

  echo ""
  warn "Integração Protheus — deixe em branco se ainda não tiver (pode editar depois em $ENV_FILE)"
  PROTHEUS_BASE_URL=$(prompt "PROTHEUS_BASE_URL" PROTHEUS_BASE_URL "https://protheus.exemplo.com.br/rest")
  PROTHEUS_AUTH_MODE=$(prompt "PROTHEUS_AUTH_MODE (oauth2 / basic)" PROTHEUS_AUTH_MODE "oauth2")
  PROTHEUS_CLIENT_ID=$(prompt "PROTHEUS_CLIENT_ID" PROTHEUS_CLIENT_ID "")
  PROTHEUS_CLIENT_SECRET=$(prompt "PROTHEUS_CLIENT_SECRET" PROTHEUS_CLIENT_SECRET "")
  PROTHEUS_BASIC_USER=$(prompt "PROTHEUS_BASIC_USER" PROTHEUS_BASIC_USER "")
  PROTHEUS_BASIC_PASS=$(prompt "PROTHEUS_BASIC_PASS" PROTHEUS_BASIC_PASS "")

  echo ""
  warn "Observabilidade — deixe em branco para desativar exportação (OTel debug local)"
  DD_API_KEY=$(prompt "DD_API_KEY (Datadog)" DD_API_KEY "")
  DD_SITE=$(prompt "DD_SITE" DD_SITE "datadoghq.com")
  SIGNOZ_OTLP_ENDPOINT=$(prompt "SIGNOZ_OTLP_ENDPOINT" SIGNOZ_OTLP_ENDPOINT "")
  SIGNOZ_INGESTION_KEY=$(prompt "SIGNOZ_INGESTION_KEY" SIGNOZ_INGESTION_KEY "")

  log "Gravando $ENV_FILE..."
  cat > "$ENV_FILE" <<EOF
# AICOCKPIT — Production .env
# Gerado em: $(date -u +"%Y-%m-%dT%H:%M:%SZ") pelo provision-vps.sh
# NUNCA commite este arquivo.

# ── Domínio e TLS ────────────────────────────────────────────────────────
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
# Troque para produção após validar com staging:
# ACME_CA_SERVER=https://acme-v02.api.letsencrypt.org/directory
ACME_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory

# ── Imagens Docker (GHCR) ────────────────────────────────────────────────
IMAGE_OWNER=${IMAGE_OWNER}
IMAGE_TAG=latest

# ── Banco de dados ───────────────────────────────────────────────────────
POSTGRES_USER=governa
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=governa_prod

# ── Redis ────────────────────────────────────────────────────────────────
REDIS_PASSWORD=${REDIS_PASSWORD}

# ── Segredos da aplicação ────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
PII_HMAC_SECRET=${PII_HMAC_SECRET}

# ── Integração Protheus ──────────────────────────────────────────────────
PROTHEUS_BASE_URL=${PROTHEUS_BASE_URL}
PROTHEUS_AUTH_MODE=${PROTHEUS_AUTH_MODE}
PROTHEUS_CLIENT_ID=${PROTHEUS_CLIENT_ID}
PROTHEUS_CLIENT_SECRET=${PROTHEUS_CLIENT_SECRET}
PROTHEUS_BASIC_USER=${PROTHEUS_BASIC_USER}
PROTHEUS_BASIC_PASS=${PROTHEUS_BASIC_PASS}

# ── Observabilidade ──────────────────────────────────────────────────────
DD_API_KEY=${DD_API_KEY}
DD_SITE=${DD_SITE}
SIGNOZ_OTLP_ENDPOINT=${SIGNOZ_OTLP_ENDPOINT}
SIGNOZ_INGESTION_KEY=${SIGNOZ_INGESTION_KEY}
EOF

  chmod 600 "$ENV_FILE"
  log ".env criado com permissão 600."
}

print_summary() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " PROVISIONAMENTO CONCLUÍDO"
  echo "═══════════════════════════════════════════════════════════════"
  echo " Repositório : $INSTALL_DIR"
  echo " .env        : $ENV_FILE"
  echo ""
  echo " PRÓXIMOS PASSOS:"
  echo ""
  echo " 1. Adicione a chave pública do GitHub Actions em:"
  echo "    echo '<CHAVE_PUBLICA>' >> ~/.ssh/authorized_keys"
  echo "    (gerada com: ./scripts/generate-deploy-key.sh)"
  echo ""
  echo " 2. Cadastre os secrets no GitHub (Environment: production):"
  echo "    VPS_HOST     = $(curl -s ifconfig.me 2>/dev/null || echo '<IP-DO-VPS>')"
  echo "    VPS_USER     = root"
  echo "    VPS_SSH_KEY  = <chave privada gerada com generate-deploy-key.sh>"
  echo "    GHCR_TOKEN   = <PAT com read:packages>"
  echo ""
  echo " 3. Valide DNS antes do deploy:"
  echo "    dig api.\$DOMAIN +short"
  echo ""
  echo " 4. Faça o primeiro deploy:"
  echo "    GitHub → Actions → Deploy → Run workflow (branch: main)"
  echo ""
  echo " 5. Após deploy, rode o smoke test:"
  echo "    ./scripts/smoke-test.sh <DOMAIN>"
  echo "═══════════════════════════════════════════════════════════════"
}

main() {
  require_root
  install_deps
  install_docker
  clone_repo
  create_env
  print_summary
}

main "$@"
