-- ============================================================================
-- Migration: tabela notification_configs (E5.4 — Canal de notificação)
--
-- Criada na sessão 2.43 para suportar notificações e-mail/webhook por tenant.
-- Um registro por tenant; upsert idempotente via PUT /notifications/config.
--
-- Pré-requisitos:
--   - 20260614120000_add_alerts (enum AlertSeverity já definido)
-- ============================================================================

CREATE TABLE "notification_configs" (
  "id"               TEXT            NOT NULL,
  "tenant_id"        TEXT            NOT NULL,
  "email_enabled"    BOOLEAN         NOT NULL DEFAULT false,
  "email_recipients" TEXT[]          NOT NULL DEFAULT '{}',
  "webhook_enabled"  BOOLEAN         NOT NULL DEFAULT false,
  "webhook_url"      TEXT,
  "webhook_secret"   TEXT,
  "min_severity"     "AlertSeverity" NOT NULL DEFAULT 'HIGH',
  "updated_at"       TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_configs_tenant_id_key" ON "notification_configs"("tenant_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "notification_configs" TO governa_app;
