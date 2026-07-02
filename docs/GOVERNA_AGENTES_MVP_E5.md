# Épica E5 — Observabilidade (OTel + SigNoz)

**Produto:** AICOCKPIT · **Repositório:** governa-core
**Status:** 🔄 em andamento | **Iniciada:** sessão 2.52 (2026-07-02)

---

## Objetivo

Instrumentar o governa-core com OpenTelemetry para coletar traces, métricas e logs,
exportando para SigNoz (self-hosted ou Cloud) como backend de observabilidade.
Permite visibilidade ponta a ponta: Angular → governa-core → Postgres.

---

## Escopo do MVP

| ID | Entregável | Status |
|---|---|---|
| E5.1 | OTel SDK inicializado em governa-core (traces, metrics, logs) | ✅ sessão 2.44 |
| E5.2 | Métricas customizadas definidas (`recordHttpRequest`, `recordAuditEvent`, `recordAgentDecision`, `recordAlertCreated`) | ✅ sessão 2.44 |
| E5.3 | Métricas wired nos pontos de chamada (HTTP middleware, AuditService, AnchorAgentService) | ✅ sessão 2.52 |
| E5.4 | SigNoz como backend — exporter ativo no OTel Collector | ✅ sessão 2.52 |
| E5.5 | OTel Collector no docker-compose — pipeline traces/metrics/logs completo | ✅ sessão 2.44 |

---

## Métricas de negócio

| Nome | Tipo | Tags | Descrição |
|---|---|---|---|
| `governa.http.requests.total` | Counter | `http.method`, `http.route`, `http.status_code` | Requisições HTTP recebidas |
| `governa.http.request.duration_ms` | Histogram | idem | Latência em ms |
| `governa.audit.events.total` | Counter | `audit.kind`, `tenant.id` | Eventos de audit trail gravados |
| `governa.agent.decisions.total` | Counter | `decision.outcome`, `tenant.id` | Decisões do agente (approved/escalated) |
| `governa.alerts.created.total` | Counter | `alert.kind`, `alert.severity`, `tenant.id` | Alertas criados |

---

## Configuração — SigNoz

### Cloud (recomendado para dev)

```bash
SIGNOZ_OTLP_ENDPOINT=https://ingest.{region}.signoz.cloud:443
SIGNOZ_INGESTION_KEY=<sua-chave>
```

### Self-hosted

```bash
SIGNOZ_OTLP_ENDPOINT=http://localhost:4317
# SIGNOZ_INGESTION_KEY não necessário
```

SigNoz self-hosted requer stack Docker própria (~5 serviços). Ver:
https://signoz.io/docs/install/docker/

---

## Variáveis de ambiente relevantes

| Variável | Default | Descrição |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Endpoint do OTel Collector local |
| `OTEL_SERVICE_NAME` | `governa-core` | Nome do serviço nos traces |
| `OTEL_SDK_DISABLED` | `false` | Desabilita OTel completamente |
| `SIGNOZ_OTLP_ENDPOINT` | — | Endpoint OTLP do SigNoz (ativa o exporter) |
| `SIGNOZ_INGESTION_KEY` | — | Chave de ingestão SigNoz Cloud (opcional para self-hosted) |
| `DD_API_KEY` | — | Chave Datadog (alternativa ao SigNoz) |

---

## Referência

- Código: `apps/governa-core/src/infra/telemetry/`
- Coletor: `infra/docker/otel-collector-config.yaml`
- Docker: `infra/docker/docker-compose.yml`
