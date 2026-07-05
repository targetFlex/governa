#!/usr/bin/env bash
# Gera o par de chaves SSH ED25519 para o deploy do GitHub Actions no VPS.
# Execute LOCALMENTE (não no servidor).
#
# Uso: ./scripts/generate-deploy-key.sh [arquivo-saida]
# Padrão: /tmp/governa-deploy-key
set -euo pipefail

KEY_FILE="${1:-/tmp/governa-deploy-key}"

if [[ -f "$KEY_FILE" ]]; then
  echo "AVISO: $KEY_FILE já existe. Apague antes de gerar novamente."
  echo "  rm \"$KEY_FILE\" \"${KEY_FILE}.pub\""
  exit 1
fi

ssh-keygen -t ed25519 -C "governa-ci-deploy@github-actions" -f "$KEY_FILE" -N ""

DIVIDER="================================================================"

echo ""
echo "$DIVIDER"
echo " 1/3 — CHAVE PÚBLICA"
echo " Cole em /root/.ssh/authorized_keys no VPS"
echo "$DIVIDER"
cat "${KEY_FILE}.pub"

echo ""
echo "$DIVIDER"
echo " 2/3 — CHAVE PRIVADA"
echo " GitHub → Settings → Secrets → Actions → Environment: production"
echo " Secret name: VPS_SSH_KEY"
echo " Cole o bloco abaixo (incluindo -----BEGIN e -----END):"
echo "$DIVIDER"
cat "$KEY_FILE"

echo ""
echo "$DIVIDER"
echo " 3/3 — PRÓXIMOS PASSOS"
echo "$DIVIDER"
echo " a) Copie a chave pública acima para o VPS:"
echo "    ssh root@<IP-DO-VPS> 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys' < ${KEY_FILE}.pub"
echo ""
echo " b) Cadastre VPS_SSH_KEY no GitHub com a chave privada acima."
echo ""
echo " c) Apague os arquivos locais após cadastrar:"
echo "    rm \"$KEY_FILE\" \"${KEY_FILE}.pub\""
echo "$DIVIDER"
