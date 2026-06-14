<!--
TEMPLATE de report — copiar como YYYY-MM-DD-sessao-X.Y.md.

REGRA DE OURO: este arquivo deve caber em poucos KB. É o handoff entre
sessões — não é manual nem doc de referência. Seções com mais de 15 linhas
de prosa indicam que algo virou referência e deve sair daqui para SOLUTION.md
ou E*.md, com pointer aqui.

NÃO repita conteúdo de docs/. Aponte com path + seção.
-->

# Report — Sessão X.Y · [nome-curto]

**Data:** YYYY-MM-DD
**Status:** ✅ concluída · 🟡 em andamento · 🔴 bloqueada · ⏸️ pausada
**Sessão anterior:** [`YYYY-MM-DD-sessao-X.Y.md`](./YYYY-MM-DD-sessao-X.Y.md) · ou `n/a` (primeira)

## TL;DR
Uma frase. No máximo duas.

## O que mudou no código
Marcos apenas — não lista de arquivos exaustiva.
- arquivo/módulo X — o que entrou
- arquivo/módulo Y — o que mudou

## Estado verificado do sistema
- **Banco:** migrations aplicadas (`prisma migrate status` = up to date), roles, seeds
- **Testes:** N suites · M testes · coverage X% (statements/branches/functions/lines)
- **Build:** `tsc --noEmit` OK · lint OK
- **CI/Deploy:** se aplicável

## Decisões tomadas
Rationale curto — 1 linha cada.
- **D1** — decisão · porque
- **D2** — decisão · porque

## Itens em aberto (não bloqueantes)
- [ ] item
- [ ] item

## Próxima sessão (X.Y+1) deve
- **Atacar:** objetivo curto
- **Começar lendo:** este report (e SÓ este no boot)
- **Consultar sob demanda:** `docs/GOVERNA_AGENTES_MVP_E1.md` §X.Y+1, `docs/...`
- **Atenção a:** contextos críticos que podem morder
- **Não tocar:** o que não está em escopo

## Commits da sessão
- `<sha-curto>` — mensagem
