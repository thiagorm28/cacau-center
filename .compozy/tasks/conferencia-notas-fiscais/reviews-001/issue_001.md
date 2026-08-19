---
provider: manual
pr:
round: 1
round_created_at: 2026-08-18T04:40:33Z
status: resolved
file: shared/src/allocation/resolveScan.ts
line: 99
severity: high
author: claude-code
provider_ref:
---

# Issue 001: resolveScan violates US-009 AC-3's "any order" guarantee

## Review Comment

`resolveScan` (ADR-001) is a greedy, single-scan-lookahead algorithm: at each scan it
credits whichever candidate note has the higher completion percentage *after* that one
scan, with no ability to revisit earlier decisions. This works for the reference
scenario only when the exclusive item (the trufa) is scanned *before* the shared items
(the panetones). When the shared items are scanned first, the algorithm greedily
credits every one of them to the smaller note (Nota 1, 10 expected) because `i/10 >
1/11` for every `i >= 1`, so by the time the exclusive trufa is scanned, Nota 1 already
holds all 10 panetones and Nota 2 ends with just 1/11.

This is a direct violation of US-009 AC-3 (`_user_stories.md`): "quando o operador bipa
10 panetones e 1 trufa **em qualquer ordem**, a Nota 2 termina 100% completa e a Nota 1
permanece com todos os seus itens em falta" — and of the PRD's own Business Rules,
which use this exact scenario to describe the alocação automática feature. It's also
the scenario ADR-001 itself uses to justify picking this algorithm over the
alternatives.

The gap is not accidental — it's already documented and pinned by the implementation
itself:
- `shared/src/allocation/resolveScan.test.ts:169-180` has a test literally titled "com
  a trufa por último, a nota 1 absorve os panetones (limite do recálculo por bipagem)"
  that asserts the *wrong* note ends up with the panetones.
- `backend/test/integration/notes-lifecycle.test.ts:200-203` and
  `e2e/specs/e2e-002-multi-nota.spec.ts:19-22` both hard-code "trufa scanned first" and
  explicitly comment that this specific order is required for the test to pass.

So every layer of the test suite avoids the order that the acceptance criteria says
must also work, which is why `npm test` is green despite the gap.

Suggested fix: either (a) extend `resolveScan` to defer/re-evaluate ambiguous
allocations with limited lookahead (e.g., recompute the best global assignment once a
note's candidate set collapses to a single option), or (b) if the "any order" guarantee
is infeasible for the chosen greedy design, get explicit product sign-off to narrow
US-009 AC-3's wording and document the known limitation as an ADR update instead of a
one-line code comment, so it's a tracked, accepted trade-off rather than a silently
divergent acceptance criterion.

## Triage

- Decision: `VALID` — divergência real e reproduzível, mas **bloqueada em decisão de
  produto**: nenhuma das duas saídas propostas pode ser implementada sem sign-off.
- Status: `valid` (não `resolved`). A divergência de AC-3 continua aberta.

### O que foi confirmado

O relato procede. `resolveScan` decide com o estado atual e nunca revisa a decisão, e
`resolveScan.test.ts` (UT-003, terceiro caso) já fixa o comportamento divergente: com os
10 panetones bipados antes da trufa, a nota 1 absorve todos. O gap também já estava
registrado como risco aberto na memória do workflow (`memory/MEMORY.md` → "Open Risks",
`memory/task_01.md` → "Learnings"), com follow-up explícito de decidir com o produto
entre ajuste de spec e realocação retroativa.

### Root cause: AC-1 e AC-3 são mutuamente exclusivos sem realocação

O ponto central — que a review não isola — é que isto não é um defeito de implementação
corrigível dentro do contrato atual, e sim uma **inconsistência entre dois acceptance
criteria da própria US-009**:

- **AC-1** obriga a creditar a bipagem à nota cujo percentual de conclusão fica *maior*
  depois dela. No estado inicial do cenário de referência, o primeiro panetone dá
  `1/10 = 10%` na nota 1 contra `1/11 ≈ 9,09%` na nota 2 → AC-1 **manda** creditar à
  nota 1.
- **AC-3** exige que a nota 2 termine 100% completa *nessa mesma ordem*.

A bipagem #1 é decidida sem nenhuma informação sobre as bipagens futuras — o operador
ainda não bipou a trufa, e nada no estado distingue "vêm 10 panetones + 1 trufa" de
"vêm só 10 panetones" (caso em que creditar à nota 1 é comprovadamente a decisão certa,
pois completa uma nota). Logo, **nenhuma função pura por bipagem que decide uma vez e
não revisa** pode satisfazer AC-1 e AC-3 ao mesmo tempo. Qualquer correção passa
obrigatoriamente por realocar bipagens já creditadas.

### Por que a opção (a) da review não foi implementada

Realocação retroativa não cabe no contrato nem no escopo deste batch, e tem um conflito
funcional próprio:

1. **Conflito com US-010.AC-1.** Na 10ª bipagem de panetone a nota 1 atinge 10/10 e o
   sistema a marca como concluída automaticamente. A trufa chega depois. Realocar exigiria
   *reabrir uma nota já fechada* e devolver 10 caixas, contra US-010 e contra a ADR-001
   ("Risks": operador confuso ao ver uma nota avançar/retroceder sozinha).
2. **Contradiz uma ADR aceita.** A ADR-001 está `Accepted` e registra que o usuário
   optou explicitamente pelo recálculo por bipagem, rejeitando a Alternative 2
   (resolução adiada até o item exclusivo aparecer) — exatamente a família de solução
   que AC-3 exigiria.
3. **Escopo.** O batch declara um único arquivo de código
   (`shared/src/allocation/resolveScan.ts`). Realocação muda o contrato
   `ScanResolution` (`types.ts`), a persistência em `ApplyScanEvent` + repositório
   (mover `confirmedQty` e repontar o log de auditoria `scan_events`), o estado do
   `useScanSession`, o replay da fila offline, e os testes de `backend/test/integration`
   e `e2e/`. É trabalho de tamanho de task, não de fix de review — a própria memória do
   workflow já anotava que "afetaria Task 2".

### Por que a opção (b) da review também não foi implementada

A opção (b) é, por definição, um ajuste de especificação ("get explicit product
sign-off to narrow US-009 AC-3's wording"). Estreitar um acceptance criterion escrito
pelo produto não é decisão de quem corrige a review.

### O que foi entregue neste batch

- `shared/src/allocation/resolveScan.ts`: a limitação passou a estar documentada no
  docblock do **código de produção**, com a prova de exclusividade AC-1 × AC-3, o
  conflito com US-010.AC-1 e o ponteiro para esta issue. Antes disso a divergência só
  existia num comentário de teste — que é justamente a crítica da review ("silently
  divergent acceptance criterion"). Sem mudança de comportamento.
- Nenhuma alteração de algoritmo: qualquer mudança comportamental aqui violaria AC-1 ou
  exigiria a realocação descrita acima.

### Recomendação

Adotar a opção (b): estreitar AC-3 para "o item exclusivo puxa as bipagens seguintes"
(alinhado ao texto que a própria ADR-001 já usa), corrigir o mesmo "em qualquer ordem"
em `_tests.md` (UT-003, linha 119) e registrar a limitação como emenda à ADR-001. A
opção (a) só se justifica se o produto aceitar que notas concluídas sejam reabertas e
que caixas mudem de nota na tela do operador.

**Ação necessária do usuário:** confirmar (a) ou (b) antes de fechar esta issue.

### Verificação

- `npm run typecheck` (shared + backend + frontend + e2e) → exit 0.
- `npm run build` (shared + frontend) → exit 0.
- `npm test -w shared` → 12/12 passam; `npm test -w backend -- test/unit` → 34/34 passam;
  `npm test -w frontend` → 25/25 passam.
- `npm test` (raiz) falha em 4 arquivos de `backend/test/integration` com
  `ECONNREFUSED 127.0.0.1:5432` no `beforeAll` (`startTestApp` → `runMigrations`).
  Falha **ambiental e pré-existente**, não relacionada a esta issue: não há Postgres
  local nem Docker disponível neste ambiente, e a suíte exige o database `cacau_test`
  (já registrado em `memory/MEMORY.md` → "Handoffs"). A mudança deste batch é apenas de
  comentário e não pode afetar esses testes.
