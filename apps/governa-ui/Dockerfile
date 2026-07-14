# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist/governa-ui/browser /usr/share/nginx/html

EXPOSE 80
# nginx docker image substitui variáveis de ambiente com envsubst ao iniciar
CMD ["nginx", "-g", "daemon off;"]
