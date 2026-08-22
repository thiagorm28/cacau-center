# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Concluída: `completionOrder.ts` extraído, `resolveScan` delegando sem mudança de
comportamento, `pickQuickScanNote`/`OpenNoteSummary` exportados na raiz de `shared`.

## Important Decisions

- IT-012 vive em `shared/src/packageExports.test.ts` importando de `"shared"`. Para não
  depender de um `dist/` construído, adicionei alias `shared -> ./src/index.ts` em
  `shared/vitest.config.js` e `paths` equivalente em `shared/tsconfig.json` — mesma
  convenção já usada por `backend/vitest.config.js` e `frontend/vite.config.ts`.
- UT-013 (`0/0` vs `1/5`): o texto do `_tests.md` diz que uma nota 0/0 "nunca supera" uma
  de percentual não nulo "pela multiplicação cruzada", mas a aritmética dá empate
  (`0*5 === 1*0`) e quem decide é o desempate FIFO. Escrevi o teste com a nota não nula
  aberta antes, satisfazendo o resultado esperado (`note-b`) nas duas ordens de entrada.
  UT-008 idem: documentei o empate no próprio teste.

## Learnings

- `shared/dist/` é versionado neste repo, então `npm run build` deixa arquivos de `dist`
  no diff (esperado, não sujeira).

## Files / Surfaces

- Novos: `shared/src/allocation/completionOrder.ts`, `pickQuickScanNote.ts`, seus testes,
  `shared/src/packageExports.test.ts`.
- Modificados: `resolveScan.ts` (só `isBetterCandidate`/`parseOpenedAt`), `src/index.ts`,
  `vitest.config.js`, `tsconfig.json`, `dist/` (rebuild).

## Errors / Corrections

- Docker não está disponível nesta sessão (WSL sem integração), então a suíte de
  integração do backend não foi executada; cobertura de regressão veio de
  `resolveScan.test.ts` (12 testes, sem alteração) + typecheck de todo o workspace.

## Ready for Next Run

- task_04 pode importar `pickQuickScanNote`/`OpenNoteSummary` de `"shared"`.
