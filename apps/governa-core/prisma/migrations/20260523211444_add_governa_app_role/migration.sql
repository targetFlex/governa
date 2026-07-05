-- ============================================================================
-- Migration: criar role aplicacional `governa_app` com audit_events append-only.
--
-- Promovida do draft (draft_add_governa_app_role) em 23/05/2026 após o verify
-- da sessão 1.1 confirmar que o banco real já possui a role com os grants
-- corretos. Esta migration existe para garantir REPRODUTIBILIDADE: qualquer
-- ambiente novo (CI ephemeral, onboarding, disaster recovery) recebe a mesma
-- configuração via `prisma migrate deploy`.
--
-- Pré-requisito da sessão 1.3 (AuditService) — o append-only garante a
-- imutabilidade do audit trail LGPD por restrição de banco, não apenas
-- por convenção de aplicação.
--
-- Idempotência: todos os blocos podem rodar múltiplas vezes sem efeito
-- colateral (CREATE ROLE condicional; GRANT/REVOKE/ALTER DEFAULT PRIVILEGES
-- são naturalmente idempotentes).
-- ============================================================================

-- 1) Criar role aplicacional (login). Em dev usamos senha previsível para
--    facilitar setup local; em produção a senha vem de Terraform/Vault.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'governa_app') THEN
    CREATE ROLE governa_app WITH LOGIN PASSWORD 'governa_app_dev_pw';
  END IF;
END
$$;

-- 2) Permissão de conexão ao banco e uso do schema
-- GRANT CONNECT usa SQL dinâmico para funcionar em qualquer nome de banco
-- (governa_dev, governa_prod, etc.) sem hardcode.
DO $$
BEGIN
  EXECUTE 'GRANT CONNECT ON DATABASE ' || quote_ident(current_database()) || ' TO governa_app';
END
$$;
GRANT USAGE ON SCHEMA public TO governa_app;

-- 3) Grants amplos nas tabelas operacionais (read/write normais)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON tenants, agents, policies, pending_actions
  TO governa_app;

-- 4) audit_events — APPEND-ONLY
--    Apenas SELECT e INSERT. Sem UPDATE, sem DELETE, sem TRUNCATE.
--    Esta é a restrição de banco que sustenta a integridade do audit trail.
GRANT SELECT, INSERT ON audit_events TO governa_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM governa_app;

-- 5) Sequências (defesa em profundidade — todos os PKs hoje são UUID,
--    mas migrations futuras podem adicionar colunas serial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO governa_app;

-- 6) Defaults para tabelas/sequências criadas em migrations futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO governa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO governa_app;

-- ============================================================================
-- Pós-aplicação: a aplicação deve passar a usar uma DATABASE_URL apontando
-- para o usuário governa_app (não o owner). Sugestão para .env:
--   GOVERNA_APP_DATABASE_URL="postgresql://governa_app:governa_app_dev_pw@localhost:5432/governa_dev?schema=public"
-- O PrismaClient da aplicação usa essa URL; migrations continuam rodando
-- com o owner (DATABASE_URL atual).
-- ============================================================================
