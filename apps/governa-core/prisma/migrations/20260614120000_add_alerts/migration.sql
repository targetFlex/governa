-- ============================================================================
-- Migration: tabelas alerts + alert_thresholds
--
-- Criada na sessão 2.33 para substituir o InMemoryAlertRepository temporário
-- por PrismaAlertRepository com persistência real em PostgreSQL.
--
-- Tabelas:
--   alerts           — alertas disparados pelo sistema de governança
--   alert_thresholds — configuração de threshold por kind/tenant (upsert)
--
-- Pré-requisitos: migration 20260518011539_init_multi_tenant_schema já aplicada.
-- ============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "AlertKind" AS ENUM (
  'TOOL_BLOCKED',
  'ERROR_RATE',
  'CHECKPOINT_EXPIRED',
  'VOLUME_ANOMALY'
);

CREATE TYPE "AlertSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "AlertStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED'
);

-- ─── alerts ──────────────────────────────────────────────────────────────────

CREATE TABLE "alerts" (
  "id"         TEXT          NOT NULL,
  "tenant_id"  TEXT          NOT NULL,
  "agent_id"   TEXT          NOT NULL,
  "kind"       "AlertKind"   NOT NULL,
  "severity"   "AlertSeverity" NOT NULL,
  "status"     "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "message"    TEXT          NOT NULL,
  "metadata"   JSONB         NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alerts_tenant_id_status_idx"    ON "alerts"("tenant_id", "status");
CREATE INDEX "alerts_tenant_id_created_at_idx" ON "alerts"("tenant_id", "created_at");
CREATE INDEX "alerts_tenant_id_agent_id_idx"  ON "alerts"("tenant_id", "agent_id");

-- ─── alert_thresholds ────────────────────────────────────────────────────────

CREATE TABLE "alert_thresholds" (
  "id"                    TEXT        NOT NULL,
  "tenant_id"             TEXT        NOT NULL,
  "kind"                  "AlertKind" NOT NULL,
  "enabled"               BOOLEAN     NOT NULL DEFAULT true,
  "error_rate_percent"    DOUBLE PRECISION,
  "volume_per_hour"       INTEGER,
  "checkpoint_expiry_min" INTEGER,
  "updated_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "alert_thresholds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alert_thresholds_tenant_id_kind_key" ON "alert_thresholds"("tenant_id", "kind");
CREATE INDEX        "alert_thresholds_tenant_id_idx"      ON "alert_thresholds"("tenant_id");

-- ─── Grants para governa_app ─────────────────────────────────────────────────
-- Os ALTER DEFAULT PRIVILEGES da migration anterior já cobrem novas tabelas,
-- mas garantimos explicitamente aqui por segurança.

GRANT SELECT, INSERT, UPDATE, DELETE ON "alerts"           TO governa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alert_thresholds" TO governa_app;
