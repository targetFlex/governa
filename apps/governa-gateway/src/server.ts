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

// ── OpenTelemetry — DEVE ser o primeiro import (monkey-patching antecipado) ──
import './infra/telemetry/tracer'
import { shutdownTelemetry }               from './infra/telemetry'

import 'dotenv/config'
import axios from 'axios'
import { GatewayHttpServer } from './gateway-app'
import { ProtheusLoginConnector }      from './connectors/auth/auth-login.connector'
import { ReadProtheusPedidoConnector } from './connectors/pedido/read-protheus-pedido.connector'
import { PedidoMapper }                from './connectors/pedido/pedido.mapper'
import { ReadProtheusCilenteConnector } from './connectors/cliente/read-protheus-cliente.connector'
import { ClienteMapper }               from './connectors/cliente/cliente.mapper'
import { PiiPseudonymizer }            from './connectors/shared/pii.pseudonymizer'
import { SyntheticPedidoConnector }    from './connectors/synthetic/synthetic-pedido.connector'
import { SyntheticClienteConnector }   from './connectors/synthetic/synthetic-cliente.connector'
import { SyntheticAuthConnector }      from './connectors/synthetic/synthetic-auth.connector'
import type { IPedidoConnector, IClienteConnector } from './gateway-app'
import type { IAuthLoginConnector } from './connectors/auth/auth-login.connector'

// ── Validação de env obrigatórias ────────────────────────────

// PROTHEUS_MODE=synthetic — serve dados sintéticos (piloto sandbox Target Flex,
// sem dependência de credenciais Protheus reais nem PROTHEUS_BASE_URL).
const SYNTHETIC_MODE    = process.env['PROTHEUS_MODE'] === 'synthetic'
const PROTHEUS_BASE_URL = process.env['PROTHEUS_BASE_URL']
const PII_HMAC_SECRET   = process.env['PII_HMAC_SECRET']
const PORT              = parseInt(process.env['GATEWAY_PORT'] ?? '3100', 10)

if (!SYNTHETIC_MODE && !PROTHEUS_BASE_URL) {
  console.error('[governa-gateway] PROTHEUS_BASE_URL não definida. Abortar.')
  process.exit(1)
}
if (!SYNTHETIC_MODE && (!PII_HMAC_SECRET || PII_HMAC_SECRET.length < 32)) {
  console.error('[governa-gateway] PII_HMAC_SECRET deve ter pelo menos 32 caracteres. Abortar.')
  process.exit(1)
}

// ── Composição de dependências ───────────────────────────────

let pedidoConnector:  IPedidoConnector
let clienteConnector: IClienteConnector
let authConnector:    IAuthLoginConnector

if (SYNTHETIC_MODE) {
  console.log('[governa-gateway] PROTHEUS_MODE=synthetic — servindo dados sintéticos (piloto sandbox), sem Protheus real.')
  pedidoConnector  = new SyntheticPedidoConnector()
  clienteConnector = new SyntheticClienteConnector()
  authConnector    = new SyntheticAuthConnector()
} else {
  const http = axios.create({
    baseURL: PROTHEUS_BASE_URL,
    timeout: parseInt(process.env['PROTHEUS_TIMEOUT_MS'] ?? '10000', 10),
  })

  const pseudonymizer = new PiiPseudonymizer(PII_HMAC_SECRET as string)
  const pedidoMapper  = new PedidoMapper()
  const clienteMapper = new ClienteMapper(pseudonymizer)

  authConnector    = new ProtheusLoginConnector(PROTHEUS_BASE_URL as string)
  pedidoConnector  = new ReadProtheusPedidoConnector(http, pedidoMapper)
  clienteConnector = new ReadProtheusCilenteConnector(http, clienteMapper)
}

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
  await shutdownTelemetry()
  await server.close()
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT',  () => { void shutdown('SIGINT') })
