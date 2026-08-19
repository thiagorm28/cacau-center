# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

PWA `frontend` completo (login, busca de nota, fila, bipagem, relatório, histórico),
offline-first, com UT-044–UT-067. Concluída: 25 testes verdes (24 IDs + 1 caso extra de
feedback offline), typecheck e build limpos, dev server em 5174 servindo manifest/SW/ícones.

## Important Decisions

- Ícones do PWA gerados no repositório (`frontend/public/icons/icon-{192,512}.png`) por
  encoder PNG mínimo em Node (`zlib`), nas cores do `DESIGN.md`. Sem eles o manifest
  apontava para arquivos inexistentes e a instalabilidade — critério de sucesso da task —
  falhava silenciosamente.
- `QueuedFinalize` viaja na mesma fila do IndexedDB que as bipagens, mas é drenada pelo
  seu próprio endpoint (`POST /notes/:id/finalize`) **depois** dos scans: o
  `/scan-events/sync` só aceita bipagens, e o relatório precisa contar tudo antes do
  fechamento.
- Flush só retém a ação na fila em erro retentável (rede, 401/403, 5xx); recusa de regra
  de negócio é descartada, senão travaria todas as ações seguintes.
- Retentativa do flush é agendada por tempo (`retryToken`), nunca disparada pelo próprio
  resultado — reagir à mudança da fila viraria laço infinito.
- Rejeição de leitura duvidosa em `useBarcodeScanner` = `isValid && error === "" && text`
  + `minLineCount: 2` + lista fechada de formatos 1D.

## Learnings

- O WASM do ZXing é servido pelo próprio app (`zxing-wasm/reader/zxing_reader.wasm?url` +
  `prepareZXingModule`), não por CDN — é o que deixa o Workbox pré-cachear (`**/*.wasm`)
  e a bipagem funcionar offline. Precache final: 10 entradas / ~1.38 MiB.
- `vite.config.ts` desativa o `VitePWA` em `mode === "test"`; a suíte roda com
  `vitest run --mode test`. Rodar sem esse mode adiciona build de service worker a cada
  execução.
- `shared` é resolvido por alias para `../shared/src/index.ts` (Vite + tsconfig paths):
  app e suíte não dependem de build prévio do pacote.

## Files / Surfaces

- `frontend/` inteiro: `src/{api,components/ui,features/{auth,notes,scan,report,history},hooks,offline,routes,session,test}`,
  `vite.config.ts`, `tsconfig.json`, `index.html`, `public/icons/`.
- Fora do `frontend/`: nada. Root `package.json` já listava `"frontend"` nos workspaces.

## Errors / Corrections

- Estado herdado de execução anterior já continha quase tudo implementado e verde; esta
  execução fechou o buraco dos ícones do PWA e removeu um ternário no-op em
  `FinalizeDialog`.

## Ready for Next Run

- Task 4 (E2E): dev server em 5174 confirmado servindo `/manifest.webmanifest`,
  `/dev-sw.js?dev-sw` e `/icons/icon-192.png` com 200.
- Follow-up não bloqueante: fontes Caprasimo/Figtree vêm do Google Fonts por `<link>` e
  não entram no precache — offline o app cai nas fontes de sistema. Auto-hospedar os
  `woff2` resolveria (o `globPatterns` já inclui `woff2`).
