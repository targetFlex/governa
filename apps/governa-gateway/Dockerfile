# ============================================================
# governa-gateway — Dockerfile (multi-stage)
# ============================================================
# Stage 1: build TypeScript → JS
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependências de build
COPY package.json ./
RUN npm install --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ============================================================
# Stage 2: imagem mínima de produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiar apenas dependências de produção
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

# Copiar build compilado
COPY --from=builder /app/dist ./dist

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3100/health || exit 1

CMD ["node", "dist/src/server.js"]
