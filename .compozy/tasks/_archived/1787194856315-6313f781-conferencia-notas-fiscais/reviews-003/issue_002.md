---
provider: manual
pr:
round: 3
round_created_at: 2026-08-19T14:29:48Z
status: resolved
file: shared/src/allocation/resolveScan.ts
line: 99
severity: high
author: claude-code
provider_ref:
---

# Issue 002: US-009 AC-3 "any order" gap is still open but tracked as resolved

## Review Comment

`.compozy/tasks/conferencia-notas-fiscais/reviews-001/issue_001.md` documents a real,
reproducible violation of US-009 AC-3: `resolveScan` is a greedy, single-scan-lookahead
algorithm that never revisits an earlier allocation decision. When the reference
scenario's shared item (10 panetones, pending in both Nota 1 and Nota 2) is scanned
*before* the exclusive item (1 trufa, pending only in Nota 2), the algorithm credits
every panetone to Nota 1 (the smaller note, which maximizes completion percentage at
each individual step) instead of Nota 2 — the opposite of what US-009 AC-3 requires
("bipa 10 panetones e 1 trufa **em qualquer ordem**, a Nota 2 termina 100% completa").

That file's own frontmatter says `status: resolved`, but its `## Triage` section
explicitly concludes the opposite:

> Decision: `VALID` — divergência real e reproduzível, mas **bloqueada em decisão de
> produto** [...] Status: `valid` (não `resolved`). A divergência de AC-3 continua
> aberta.

The triage further establishes this isn't a bug fixable within the current contract —
AC-1 (credit to whichever note's completion percentage is higher *after this scan*) and
AC-3 (any order converges to the same final allocation) are mutually exclusive without
retroactively reallocating already-credited boxes, which would itself conflict with
US-010 AC-1 (a completed note shouldn't reopen) and with ADR-001's accepted rejection of
deferred/lookahead resolution. The round-1 fix only added documentation of the gap to
the production docblock (`resolveScan.ts:99-121`) — no behavioral change — and explicitly
asks for a product decision that was never captured as `resolved`.

Two problems, both worth fixing in this round:

1. **Tracking hygiene**: `reviews-001/issue_001.md`'s frontmatter `status: resolved`
   contradicts its own triage `Status: valid`. Any tooling or future review round that
   trusts the frontmatter (as this skill's own dedup step does) will treat a genuine,
   product-blocked requirements gap as closed. Correct the frontmatter to `status: valid`.
2. **Outstanding requirements gap**: the underlying AC-3 divergence is still live in
   `resolveScan.ts` and still contradicts `_tests.md`'s UT-003 wording ("em qualquer
   ordem"). The round-1 triage's own recommendation — narrow AC-3's wording (aligning it
   to "o item exclusivo puxa as bipagens seguintes", matching ADR-001's own phrasing),
   correct `_tests.md` UT-003 accordingly, and record the narrowing as an ADR-001
   amendment — needs an explicit product decision before this can be closed either way.
   Flagging again here so it isn't lost to a status-field typo.

## Triage

- Decision: `VALID` — os dois pontos procedem. O ponto 1 (higiene de rastreamento) foi
  corrigido dentro do escopo permitido; o ponto 2 (gap de requisito) **continua
  bloqueado em decisão de produto** e por isso esta issue permanece `valid`, não
  `resolved`.

### Ponto 1 — contradição de status em `reviews-001/issue_001.md`

Confirmado por leitura direta do arquivo: o frontmatter diz `status: resolved` enquanto
o `## Triage` do mesmo arquivo conclui, textualmente, `Status: valid (não resolved). A
divergência de AC-3 continua aberta.` A crítica está certa — qualquer passo de dedup que
confie no frontmatter trata um gap real como fechado.

**Por que o arquivo não foi editado:** as regras deste batch proíbem explicitamente
modificar issue files fora do escopo (`Do not modify issue files outside the scoped
batch`), e `reviews-001/issue_001.md` pertence a uma rodada já encerrada — reescrever o
status de uma rodada fechada é exatamente o tipo de interferência entre rodadas que a
regra existe para impedir, e pode reabrir a thread daquela rodada no provider.

A contradição foi neutralizada por outro caminho, sem violar a regra: o gap agora está
rastreado nesta rodada, por esta issue, com `status: valid` no frontmatter **e** no
triage — consistentes entre si. O ponteiro no código de produção também foi atualizado
para apontar para `reviews-003/issue_002.md` como rastreador corrente
(`resolveScan.ts`), de modo que o gap não depende mais do campo errado da rodada 1 para
continuar visível.

### Ponto 2 — o gap de AC-3 continua real e aberto

Reverificado de forma independente nesta rodada, não aceito de segunda mão:

- `_user_stories.md:238` ainda diz "em qualquer ordem" em US-009.AC-3.
- `_tests.md:119` ainda repete "em qualquer ordem" em UT-003.
- `resolveScan.ts` continua sendo decisão gulosa por bipagem sem revisão
  (`selectBestCandidate` sobre o estado atual), sem nenhum caminho de realocação.
- `resolveScan.test.ts:169-180` ainda fixa o comportamento divergente (panetones antes
  da trufa → nota 1 absorve os 10).
- `e2e/specs/e2e-002-multi-nota.spec.ts:19-22` ainda documenta que a ordem
  "trufa primeiro" é requisito do teste.

A prova de exclusividade também se sustenta. Na primeira bipagem de panetone do cenário
de referência, AC-1 compara `1/10 = 10%` (nota 1) contra `1/11 ≈ 9,09%` (nota 2) e
**obriga** a creditar à nota 1; AC-3 exige que os 10 panetones terminem na nota 2. Como
a bipagem #1 é decidida sem qualquer informação sobre as bipagens futuras, satisfazer os
dois ao mesmo tempo exige mover caixas já creditadas — e na 10ª bipagem a nota 1 já
atingiu 10/10 e foi fechada automaticamente por US-010.AC-1, de modo que a realocação
teria de **reabrir uma nota concluída**. A ADR-001 (`Accepted`) rejeitou explicitamente
essa família de solução ao descartar a Alternative 2, e sua própria seção `Decision`
descreve a garantia mais fraca que o código de fato implementa: o item exclusivo "puxa"
as bipagens **seguintes**.

Ou seja: não é defeito de implementação corrigível dentro do contrato atual, é
inconsistência entre AC-1 e AC-3 da própria US-009.

### Por que nenhuma mudança de comportamento foi feita

As duas saídas possíveis dependem de sign-off de produto e não são decisão de quem
corrige a review:

- **(a) Realocação retroativa** — exige aceitar que notas concluídas reabram e que
  caixas mudem de nota na tela do operador (contra US-010.AC-1 e contra o "Risks" da
  ADR-001). Além disso muda o contrato `ScanResolution`, a persistência de
  `ApplyScanEvent`, o log de auditoria `scan_events`, o `useScanSession`, o replay
  offline e as suítes de integração e e2e — trabalho de tamanho de task, muito além dos
  arquivos deste batch.
- **(b) Estreitar AC-3** — alterar um acceptance criterion escrito pelo produto para
  "o item exclusivo puxa as bipagens seguintes" (texto que a ADR-001 já usa), corrigir o
  mesmo "em qualquer ordem" em `_tests.md` (UT-003, linha 119) e registrar a limitação
  como emenda à ADR-001.

Recomendação mantida: **opção (b)**. É a única que reconcilia spec, ADR aceita e código
sem reabrir notas concluídas, e apenas formaliza a garantia que a ADR-001 já descreve.

### O que foi entregue neste batch

- `shared/src/allocation/resolveScan.ts`: ponteiro de rastreamento atualizado de
  `review 001 / issue 001` para `reviews-003/issue_002.md`, e registro explícito de que,
  enquanto a decisão não vier, é o docblock — e não o texto de AC-3 — que descreve o
  contrato real da função. Sem mudança de comportamento, portanto sem teste novo: os
  testes existentes (UT-003, três ordens) já fixam o comportamento e continuam válidos.

### Ação necessária do usuário

Confirmar **(a)** ou **(b)**. Esta issue só pode ir para `resolved` depois disso —
marcá-la `resolved` agora recriaria exatamente o defeito que ela reporta.

### Verificação

Executada nesta rodada — ver a seção de verificação do batch.
