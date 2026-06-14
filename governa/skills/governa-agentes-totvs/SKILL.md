---
name: governa-agentes-totvs
description: "Governa o ciclo de sessões do agente no domínio TOTVS. Invoque ao abrir uma nova sessão (ex: 'vamos para a 1.3', 'próxima sessão', 'governa-agentes-totvs'). A skill impõe o boot protocol: monta o diretório do projeto, lê o report mais recente em governa/docs/reports/, confirma handoff em 1 linha e só então inicia o trabalho. Nunca lê SOLUTION.md ou arquivos de entregável (E1.md, E2.md, etc.) no boot."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, mcp__cowork__request_cowork_directory, mcp__github__push_files, mcp__github__create_or_update_file, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__get_pull_request, mcp__github__get_pull_request_status, mcp__github__merge_pull_request, mcp__github__create_pull_request_review, mcp__github__list_commits, mcp__github__get_file_contents, mcp__github__create_branch, mcp__github__search_code
---

# Governa Agentes TOTVS

Skill de governança de sessões para desenvolvimento no domínio TOTVS.
Define o **protocolo de ciclo de vida** de cada sessão: como iniciar, como trabalhar e como encerrar.

---

## SEÇÃO 0 — Boot Protocol (CRÍTICO — executar antes de qualquer outra coisa)

> Esta seção é **obrigatória e inegociável**. O agente NÃO deve ler SOLUTION.md, E1.md, E2.md
> ou qualquer outro arquivo de entregável durante o boot. O único arquivo lido no boot é o
> report mais recente em `governa/docs/reports/`.

### 0.1 Passos do Boot (executar nesta ordem exata)

**Passo 0 — Montar o diretório do projeto**

Antes de qualquer Glob ou Read, garantir que o diretório `/Users/fabiogomes/dev` está conectado:

```
mcp__cowork__request_cowork_directory({ path: '/Users/fabiogomes/dev' })
```

> Esta chamada é idempotente: se o diretório já estiver montado, retorna imediatamente sem pedir
> nova aprovação ao usuário.
> **NUNCA pular este passo** — sem ele o Glob retorna vazio e o boot falha silenciosamente.

**Passo 1 — Localizar o report mais recente**

```
Glob: governa/docs/reports/*.md   (path base: /Users/fabiogomes/dev)
→ ordenar por nome (YYYY-MM-DD garante ordem cronológica)
→ selecionar o mais recente (excluir _template.md)
```

Se `governa/docs/reports/` não existir ou estiver vazia → perguntar ao usuário:
> "Não encontrei nenhum report em governa/docs/reports/. Esta é a primeira sessão? Se sim, me diga o número da sessão (ex: 1.1) e o contexto inicial."

**Passo 2 — Ler o report mais recente**

```
Read: /Users/fabiogomes/dev/governa/docs/reports/{arquivo-mais-recente}.md
```

**Passo 3 — Confirmar em UMA linha antes de qualquer trabalho**

Formato obrigatório:
> "Li o report de {YYYY-MM-DD} — sessão {X.Y}. Próximo: {handoff em até 10 palavras}. Confirma?"

Exemplos válidos:
> "Li o report de 2026-05-23 — sessão 1.2. Próximo: AuditService + AuditVerifier. Confirma?"
> "Li o report de 2026-05-26 — sessão 2.3. Próximo: conector read_protheus_produto. Confirma?"

**Passo 4 — Aguardar confirmação explícita do usuário**

Só avançar após "sim", "confirma", "pode ir", ou equivalente.
Se o usuário corrigir o handoff → atualizar entendimento e confirmar novamente.

### 0.2 O que NUNCA fazer no boot

- NÃO pular o Passo 0 (mount) — causa Glob vazio e boot silenciosamente quebrado
- NÃO ler `SOLUTION.md` (nenhuma variante)
- NÃO ler `E1.md`, `E2.md` ou qualquer arquivo de entregável
- NÃO ler arquivos de código antes da confirmação
- NÃO iniciar trabalho antes da confirmação do usuário
- NÃO resumir a sessão anterior "de memória" — sempre ler o report

### 0.3 Checklist de Boot (auto-verificação interna)

Antes de começar a trabalhar, confirmar internamente:

- [ ] Chamei `mcp__cowork__request_cowork_directory({ path: '/Users/fabiogomes/dev' })`
- [ ] Li o arquivo `/Users/fabiogomes/dev/governa/docs/reports/{mais-recente}.md`
- [ ] Confirmei com o usuário em 1 linha
- [ ] Recebi confirmação explícita
- [ ] NÃO abri SOLUTION.md ou E{N}.md

Se qualquer item falhar → parar e corrigir antes de prosseguir.

---

## SEÇÃO 0.5 — Princípio de Autonomia Total (INEGOCIÁVEL)

> O agente NUNCA deve pedir ao usuário para executar comandos git manualmente.
> Todo push, commit remoto, PR, merge e review vai via GitHub MCP.
> Ação manual do usuário = falha de protocolo.

### Mapeamento git → GitHub MCP

| Operação git (proibida via bash) | Substituto GitHub MCP |
|---|---|
| `git push origin <branch>` | `mcp__github__push_files` |
| `git push` (arquivo único) | `mcp__github__create_or_update_file` |
| `gh pr create` | `mcp__github__create_pull_request` |
| `gh pr merge` | `mcp__github__merge_pull_request` |
| `gh pr review` | `mcp__github__create_pull_request_review` |
| `git checkout -b <branch>` | `mcp__github__create_branch` |
| `git log` / `git show` | `mcp__github__list_commits` |
| `cat <arquivo> no repo` | `mcp__github__get_file_contents` |

### Fluxo autônomo de sessão de código

```
1. Boot → ler report → confirmar handoff com usuário
2. Criar branch via mcp__github__create_branch (se nova feature)
3. Escrever código localmente (Write/Edit)
4. Rodar testes localmente (Bash: pnpm test --coverage)
5. Push do código via mcp__github__push_files (NUNCA git push)
6. Abrir PR via mcp__github__create_pull_request
7. Verificar CI via mcp__github__get_pull_request_status
8. Se CI verde → merge via mcp__github__merge_pull_request
9. Escrever report → push via mcp__github__push_files → informar hash
```

### Fallback — GitHub MCP indisponível

Se qualquer ferramenta `mcp__github__*` falhar:
> "GitHub MCP fora de alcance. Operação pendente: {descrever o que não foi feito}. Acesse `/mcp` no Cowork e reautentique `plugin:engineering:github`. Após reconexão, retomo automaticamente."

NUNCA pedir `git push`, `gh pr create` ou qualquer comando manual ao usuário.

---

## SEÇÃO 1 — Durante a Sessão

### 1.1 Fonte de verdade

O **report da sessão anterior** é a única fonte de verdade no início.
O agente só abre outros arquivos (SOLUTION.md, E1.md, código, etc.) se:
- O report indicar explicitamente que deve fazê-lo, **ou**
- O usuário pedir durante a sessão

### 1.2 Regras de trabalho

- Trabalhar **apenas no escopo do handoff confirmado**
- Se surgir escopo novo fora do handoff → perguntar antes de expandir:
  > "Isso está fora do handoff da sessão. Posso incluir ou preferes registrar para a próxima?"
- Decisões relevantes → registrar mentalmente para o report de fechamento
- Desvios do plano → comunicar imediatamente, não silenciosamente

### 1.3 Nomenclatura de sessões

Formato: `X.Y`
- `X` = ciclo / épico principal
- `Y` = sessão sequencial dentro do ciclo
- Exemplos: `1.1`, `1.2`, `1.3`, `2.1`

---

## SEÇÃO 2 — Protocolo de Encerramento

Ativado quando o usuário disser: **"encerrar sessão"**, **"fecha a sessão"**, **"vamos encerrar"** ou equivalente.

### 2.1 Estrutura do Report

Criar em: `/Users/fabiogomes/dev/governa/docs/reports/YYYY-MM-DD-sessao-X.Y.md`

```markdown
# Report — Sessão {X.Y} — {YYYY-MM-DD}

## TL;DR
{2-3 frases: o que foi feito, resultado, estado final}

## Estado
{Concluída | Parcial | Bloqueada}

Motivo (se Parcial ou Bloqueada):
{explicar o que impediu a conclusão}

## O que foi feito
- {item 1}
- {item 2}

## Decisões tomadas
- {decisão 1}: {motivação em 1 linha}
- {decisão 2}: {motivação em 1 linha}

## Desvios do plano
- {desvio 1 ou "Nenhum"}

## Handoff — próxima sessão {X.Z}
{Instrução direta: o que o próximo agente deve fazer primeiro.
Máximo 2 frases. Sem ambiguidade.}

## Arquivos modificados
- `{caminho/arquivo.ts}` — {o que mudou em 5 palavras}

## Pendências / alertas para sessões futuras
- {alerta 1 ou "Nenhum"}
```

### 2.2 Fluxo de encerramento

1. Escrever o report em `/Users/fabiogomes/dev/governa/docs/reports/YYYY-MM-DD-sessao-X.Y.md`
2. Fazer push direto via GitHub MCP — **sem git local, sem SSH, sem ação manual do usuário**:
   ```
   mcp__github__push_files({
     owner: "targetFlex",
     repo: "governa",
     branch: "{branch da sessão, ou 'main' se não houver feature branch ativa}",
     message: "chore: report sessão X.Y — {TL;DR em 1 linha}",
     files: [{
       path: "governa/docs/reports/YYYY-MM-DD-sessao-X.Y.md",
       content: "{conteúdo completo do report}"
     }]
   })
   ```
3. Confirmar ao usuário com o hash do commit e a branch.

> **REGRA**: o usuário confia no conteúdo do report — NÃO perguntar "Confirmas?" antes de commitar.
> Escrever → push via GitHub MCP → informar. Sem etapa de aprovação intermediária. Sem `git push` manual.

### 2.3 Fallback — GitHub MCP indisponível

Se `mcp__github__push_files` falhar ou o GitHub MCP não estiver autenticado:

1. **NÃO** usar `git push` via bash (SSH bloqueado na sandbox)
2. **NÃO** pedir ao usuário para rodar `git push` manualmente
3. Informar imediatamente:
   > "GitHub MCP fora de alcance. Report escrito localmente mas não pushado. Para restaurar: acesse `/mcp` no Cowork e reautentique `plugin:engineering:github`. Após reconexão, faço o push automaticamente."
4. Aguardar restauração do MCP — após confirmação do usuário, executar o push.

### 2.4 O que NUNCA fazer no encerramento

- NÃO pedir confirmação do usuário antes de commitar o report
- NÃO usar `git push` via bash (SSH bloqueado na sandbox — sempre falha)
- NÃO pedir ao usuário para rodar `git push` manualmente
- NÃO escrever report vago — o handoff deve ser acionável
- NÃO omitir desvios ou decisões relevantes
- NÃO criar múltiplos reports para a mesma sessão

---

## SEÇÃO 3 — Estrutura de Diretórios Esperada

```
/Users/fabiogomes/dev/          ← diretório montado via request_cowork_directory
  governa/
    docs/
      reports/
        YYYY-MM-DD-sessao-1.1.md   ← mais antigo
        YYYY-MM-DD-sessao-1.2.md
        YYYY-MM-DD-sessao-2.3.md   ← mais recente (lido no boot)
        _template.md               ← ignorar no Glob (não é report)
    apps/
      governa-gateway/
        src/connectors/
      governa-core/
    skills/
      governa-agentes-totvs/
        SKILL.md                   ← fonte editável desta skill (aqui)
```

> **Caminhos corretos:**
> - Glob base path: `/Users/fabiogomes/dev`
> - Pattern: `governa/docs/reports/*.md`
> - Read: `/Users/fabiogomes/dev/governa/docs/reports/{arquivo}.md`

---

## SEÇÃO 4 — Diagnóstico de Protocolo

Se o agente perceber que violou o protocolo (ex: leu SOLUTION.md no boot):

1. Parar imediatamente
2. Reportar ao usuário:
   > "Protocolo violado: abri {arquivo} antes da confirmação do boot. Isso indica falha na seção 0 do SKILL.md. Reportar na próxima sessão para correção."
3. Não continuar sem confirmação do usuário
4. Registrar o desvio no report de encerramento

---

## SEÇÃO 5 — Auto-Aprimoramento

Se durante a sessão surgir uma regra ou padrão que deveria ser permanente:

> "Identifiquei que {padrão} seria útil como regra permanente nesta skill. Queres que eu atualize a skill `governa-agentes-totvs`?"

Só atualizar após aprovação explícita. O arquivo fonte editável está em:
`/Users/fabiogomes/dev/governa/skills/governa-agentes-totvs/SKILL.md`

Após editar, empacotar e reinstalar:
```bash
cd /Users/fabiogomes/dev/governa/skills
zip -r governa-agentes-totvs.skill governa-agentes-totvs/
# Apresentar o .skill ao usuário → botão "Save skill" instala a nova versão
```
