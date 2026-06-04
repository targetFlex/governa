// ============================================================
// server.ts — Bootstrap do governa-gateway
//
// Composição raiz (Hexagonal Architecture):
//   lê env → instancia connectors → cria GatewayHttpServer → listen
//
// Env vars obrigatórias (ver .env.example):
//   PROTHEUS_BASE_URL   — URL base da API REST Protheus
//   PII_HMAC_SECRET     — chave HMAC para ofuscação de PII
//   GATEWAY_PORT        — porta HTTP (padrão: 3100)
//   NODE_ENV            — environment
// ============================================================

import 'dotenv/config'
import axios from 'axios'
import { GatewayHttpServer } from './gateway-app'
import { ProtheusLoginConnector }      from './connectors/auth/auth-login.connector'
import { ReadProtheusPedidoConnector } from './connectors/pedido/read-protheus-pedido.connector'
import { PedidoMapper }                from './connectors/pedido/pedido.mapper'
import { ReadProtheusCilenteConnector } from './connectors/cliente/read-protheus-cliente.connector'
import { ClienteMapper }               from './connectors/cliente/cliente.mapper'
import { PiiPseudonymizer }            from './connectors/shared/pii.pseudonymizer'

// ── Validação de env obrigatórias ────────────────────────────

const PROTHEUS_BASE_URL = process.env['PROTHEUS_BASE_URL']
const PII_HMAC_SECRET   = process.env['PII_HMAC_SECRET']
const PORT              = parseInt(process.env['GATEWAY_PORT'] ?? '3100', 10)

if (!PROTHEUS_BASE_URL) {
  console.error('[governa-gateway] PROTHEUS_BASE_URL não definida. Abortar.')
  process.exit(1)
}
if (!PII_HMAC_SECRET || PII_HMAC_SECRET.length < 32) {
  console.error('[governa-gateway] PII_HMAC_SECRET deve ter pelo menos 32 caracteres. Abortar.')
  process.exit(1)
}

// ── Composição de dependências ───────────────────────────────

const http = axios.create({
  baseURL: PROTHEUS_BASE_URL,
  timeout: parseInt(process.env['PROTHEUS_TIMEOUT_MS'] ?? '10000', 10),
})

const pseudonymizer    = new PiiPseudonymizer(PII_HMAC_SECRET)
const pedidoMapper     = new PedidoMapper()
const clienteMapper    = new ClienteMapper(pseudonymizer)

const authConnector    = new ProtheusLoginConnector(PROTHEUS_BASE_URL)
const pedidoConnector  = new ReadProtheusPedidoConnector(http, pedidoMapper)
const clienteConnector = new ReadProtheusCilenteConnector(http, clienteMapper)

// ── Inicialização ─────────────────────────────────────────────

const server = new GatewayHttpServer(pedidoConnector, clienteConnector, authConnector)

server.listen(PORT).then((effectivePort) => {
  console.log(`[governa-gateway] HTTP server listening on port ${effectivePort} (${process.env['NODE_ENV'] ?? 'development'})`)
}).catch((err: unknown) => {
  console.error('[governa-gateway] Falha ao iniciar servidor:', err)
  process.exit(1)
})

// ── Graceful shutdown ─────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[governa-gateway] ${signal} recebido — encerrando graciosamente…`)
  await server.close()
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT',  () => { void shutdown('SIGINT') })
