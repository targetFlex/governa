-- ============================================================================
-- Migration: campos de config estendida do agente (E8 — templates + preview)
--
-- Criada na sessão 2.71 para suportar a jornada de criação de agentes com
-- templates do domínio TOTVS e preview de configuração (YAML).
--
-- Adiciona ao model Agent:
--   system_prompt  TEXT       — system prompt livre (opcional, max ~4000 no app)
--   mcp_servers    JSONB      — conectores MCP (metadado descritivo nesta fase)
--   skills         JSONB      — módulos de capacidade (array de strings)
--   template_id    TEXT       — rastreabilidade do template de origem (null = em branco)
--
-- ESTRITAMENTE ADITIVA / NULLABLE:
--   - Nenhuma coluna existente é alterada ou removida.
--   - system_prompt e template_id são NULL-able.
--   - mcp_servers e skills têm DEFAULT '[]', logo agentes já existentes
--     recebem array vazio sem necessidade de backfill manual.
--   - Sem downtime: agents está ACTIVE em produção e a operação é apenas
--     ADD COLUMN com default constante (fast path do Postgres, sem rewrite).
--
-- Privilégios: governa_app já possui SELECT/INSERT/UPDATE/DELETE na tabela
-- "agents" (add_governa_app_role) — privilégios de coluna são herdados do
-- nível de tabela para colunas novas; nenhum GRANT adicional é necessário.
-- ============================================================================

ALTER TABLE "agents" ADD COLUMN "system_prompt" TEXT;
ALTER TABLE "agents" ADD COLUMN "mcp_servers"   JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "agents" ADD COLUMN "skills"        JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "agents" ADD COLUMN "template_id"   TEXT;
