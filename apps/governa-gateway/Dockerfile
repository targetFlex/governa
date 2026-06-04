# ============================================================
# governa-gateway — Dockerfile (multi-stage)
# ============================================================
# Usa pnpm para consistência com o workspace monorepo.
# Build context: apps/governa-gateway  (sem acesso ao root lockfile)
# pnpm install sem lockfile é equivalente a npm install aqui — aceitável
# para dev/staging. Em prod, gere package-lock.json no app e use npm ci.
# ============================================================

# Stage 1: build TypeScript → JS
FROM node:20-alpine AS builder
WORKDIR /app

# Habilita corepack para usar a versão de pnpm definida no workspace
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Instalar dependências (inclui devDeps para tsc + tsx)
COPY package.json ./
RUN pnpm install --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

# ============================================================
# Stage 2: imagem mínima de produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copiar apenas dependências de produção
COPY package.json ./
RUN pnpm install --prod --ignore-scripts

# Copiar build compilado
COPY --from=builder /app/dist ./dist

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3100/health || exit 1

CMD ["node", "dist/src/server.js"]
