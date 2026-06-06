# ============================================================
# governa-core — Dockerfile (multi-stage)
# ============================================================
# Requer variáveis de ambiente no runtime:
#   DATABASE_URL     — PostgreSQL (Prisma)
#   GATEWAY_BASE_URL — URL interna do governa-gateway
#   JWT_SECRET       — segredo HS256 para tenantMiddleware
#   PORT             — porta HTTP (default: 3000)
#
# O entrypoint executa prisma migrate deploy antes de subir o
# servidor, garantindo que o schema está sincronizado com o DB.
# ============================================================

# ── Stage 1: build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Instalar todas as deps (inclui devDeps: tsc)
# .npmrc com shamefully-hoist=true garante layout flat
COPY .npmrc package.json ./
RUN pnpm install --ignore-scripts

# Copiar schema, gerar cliente Prisma e compilar TypeScript
COPY prisma/ ./prisma/
RUN pnpm exec prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN pnpm run build

# ── Stage 2: runner ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# OpenSSL necessário para o schema engine do Prisma (migrate deploy)
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Instalar apenas deps de produção (inclui prisma CLI + @prisma/client)
COPY .npmrc package.json ./
RUN pnpm install --prod --ignore-scripts

# Copiar schema e gerar cliente Prisma no runner
# (Prisma 5.x WASM: o engine é bundled em @prisma/client, sem .prisma/)
COPY prisma/ ./prisma/
RUN pnpm exec prisma generate

# Build compilado
COPY --from=builder /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Migração automática + start do servidor
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server.js"]
