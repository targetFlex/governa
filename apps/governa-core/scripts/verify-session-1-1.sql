-- ============================================================================
-- Verificação da Sessão 1.1 (Schema + Migrations + Seed)
-- ============================================================================
-- Como rodar:
--   Opção A (Adminer):
--     1. Abra http://localhost:8080
--     2. System: PostgreSQL · Server: postgres · User: governa
--        Password: governa_dev_pw · Database: governa_dev
--     3. Cole este arquivo inteiro em "SQL command" e execute
--
--   Opção B (docker exec):
--     docker compose -f infra/docker/docker-compose.yml exec -T postgres \
--       psql -U governa -d governa_dev < apps/governa-core/scripts/verify-session-1-1.sql
--
--   Opção C (Prisma):
--     cd apps/governa-core
--     pnpm prisma db execute --file scripts/verify-session-1-1.sql --schema prisma/schema.prisma
-- ============================================================================

-- [1] Contagens das 5 tabelas
-- Esperado: tenants=1, agents=1, policies=1, audit_events=0, pending_actions=0
SELECT 'CHECK 1 — contagens (esperado: 1,1,1,0,0)' AS check_name;
SELECT 'tenants'         AS tabela, COUNT(*)::int AS registros FROM tenants
UNION ALL SELECT 'agents',          COUNT(*)::int FROM agents
UNION ALL SELECT 'policies',        COUNT(*)::int FROM policies
UNION ALL SELECT 'audit_events',    COUNT(*)::int FROM audit_events
UNION ALL SELECT 'pending_actions', COUNT(*)::int FROM pending_actions
ORDER BY tabela;

-- [2] Seed do tenant Target Flex
-- Esperado: 1 linha com slug='target-flex-dev'
SELECT 'CHECK 2 — tenant target-flex-dev' AS check_name;
SELECT id, name, slug, plan, active
FROM tenants
WHERE slug = 'target-flex-dev';

-- [3] Seed da política consultiva
-- Esperado: 1 linha com 3 allowed_actions
SELECT 'CHECK 3 — política policy-atendimento-consultivo' AS check_name;
SELECT id, name, autonomy_level, allowed_actions, version
FROM policies
WHERE id = 'policy-atendimento-consultivo';

-- [4] Seed do agente âncora
-- Esperado: 1 linha SANDBOX/CONSULTIVO ligada à política acima
SELECT 'CHECK 4 — agente agent-atendimento-v1' AS check_name;
SELECT a.id, a.name, a.status, a.model_id, a.policy_id, p.autonomy_level
FROM agents a
LEFT JOIN policies p ON p.id = a.policy_id
WHERE a.id = 'agent-atendimento-v1';

-- [5] Role governa_app — existência
-- Esperado: 1 linha. SE VAZIO → débito da sessão 1.1 confirmado
SELECT 'CHECK 5 — role governa_app existe?' AS check_name;
SELECT rolname, rolcanlogin, rolsuper
FROM pg_roles
WHERE rolname = 'governa_app';

-- [6] Grants da role governa_app em audit_events
-- Esperado: apenas INSERT e SELECT (append-only). SE VAZIO ou tiver UPDATE/DELETE → falha LGPD
SELECT 'CHECK 6 — grants append-only em audit_events' AS check_name;
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'governa_app'
  AND table_name = 'audit_events'
ORDER BY privilege_type;

-- [7] Grants da role governa_app nas demais tabelas
-- Esperado: SELECT + INSERT + UPDATE em tenants/agents/policies/pending_actions
SELECT 'CHECK 7 — grants nas demais tabelas' AS check_name;
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS grants
FROM information_schema.role_table_grants
WHERE grantee = 'governa_app'
  AND table_name IN ('tenants','agents','policies','pending_actions')
GROUP BY table_name
ORDER BY table_name;
