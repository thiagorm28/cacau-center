# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Motor de alocação compartilhado (`shared/src/allocation`) + scaffold do workspace npm.
- Concluído. Escopo real desta execução: apenas a suíte UT-001–UT-010; o scaffold, os
  tipos e o `resolveScan` já existiam no workspace no início da run e conferem com o
  `_techspec.md` (Core Interfaces) campo a campo.

## Important Decisions

- Testes co-locados em `shared/src/allocation/resolveScan.test.ts` (o `vitest.config.js`
  já inclui `src/**/*.test.ts` e o `tsconfig.build.json` já exclui `*.test.ts` do `dist`).
- UT-003 escrito em três cenários: trufa primeiro (AC-3 satisfeito), trufa antes dos
  panetones compartilhados (AC-3 satisfeito) e trufa por último (comportamento real
  divergente, fixado como teste de limite). Ver "Learnings".
- UT-010 usa duas notas simétricas (1 panetone + 1 trufa cada); nesse conjunto a
  alocação final é de fato independente de ordem. Conjuntos assimétricos não são.

## Learnings

- O algoritmo guloso por bipagem da ADR-001 não satisfaz "em qualquer ordem" de
  US-009.AC-3 / UT-003: com os 10 panetones bipados antes da trufa, a nota 1 maximiza o
  percentual em cada bipagem individual e absorve todos, resultando em nota 1 completa.
  A própria ADR-001 só garante que o item exclusivo puxa as bipagens *seguintes*.
  Reverter bipagens anteriores exigiria lookahead, explicitamente rejeitado pela ADR.
  Precedência aplicada: TechSpec/ADR (algoritmo) acima do texto "qualquer ordem".

## Files / Surfaces

- `shared/src/allocation/resolveScan.test.ts` (novo, único arquivo criado nesta run).

## Errors / Corrections

- Nenhum.

## Ready for Next Run

- `npm run typecheck -w shared`, `npm run build -w shared`, `npm run test -w shared`
  passam limpos (12 testes).
- Follow-up: decidir com o produto se a divergência de US-009.AC-3 vira ajuste de spec
  ou requisito de realocação retroativa (afetaria Task 2, que persiste o log de eventos).
