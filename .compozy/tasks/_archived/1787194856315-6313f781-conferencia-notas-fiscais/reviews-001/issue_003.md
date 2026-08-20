---
provider: manual
pr:
round: 1
round_created_at: 2026-08-18T04:40:33Z
status: resolved
file: backend/src/infra/gateway/NfeGateway.ts
line: 115
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Malformed qCom from the untrusted NFe API silently erases an item

## Review Comment

`parse()` builds each item's `quantidade` with a bare `Number.parseFloat`, with no
validation that the result is a finite positive number:

```ts
quantidade: Number.parseFloat(asText(prod.qCom)),
```

If `qCom` is missing, empty, or non-numeric in the upstream XML, this yields `NaN`,
which flows straight into `NoteItem`'s constructor
(`backend/src/domain/entity/NoteItem.ts:15`):

```ts
if (expectedQty <= 0) throw new Error("Quantidade esperada deve ser maior que zero");
```

`NaN <= 0` is `false` in JS, so this guard does not catch it — a `NoteItem` with
`expectedQty = NaN` is constructed successfully. From there, every comparison against
`NaN` is `false`:

- `isPending()` (`confirmedQty < expectedQty`) is always `false`, so the item is never
  counted as pending — `hasPendingItems()`/`isFullyConfirmed()` treat the note as
  complete without this item ever being scanned.
- `getMissingQty()` returns `NaN`, and `DivergenceReport`'s `missingItems` filter
  (`item.missingQty > 0`) is also `false` for `NaN`, so the item doesn't even appear in
  the divergence report.

The net effect: a single malformed quantity field makes that item vanish from
completion and divergence tracking entirely — the note can auto-complete as
`completed` with a box that was never actually verified, and the operator/gerente get
no trace of it anywhere. This is exactly the "conte com certeza" invariant the PRD
calls out as a core goal, and the `_techspec.md` Known Risks section already flags this
integration as unauthenticated with an "unknown error contract" — i.e., the team
already expects this upstream to misbehave, just hasn't covered this specific failure
mode.

Suggested fix: validate parsed numeric/string fields in `NfeGatewayHttp.parse()` (finite
`quantidade > 0`, non-empty `cProd`) and throw a dedicated parsing error (e.g.
`NfeNotFoundError` or a new `NfeInvalidDataError`) rather than let `NaN`/empty values
reach the domain layer.

## Triage

- Decision: `VALID`
- Notes:

Confirmado ponta a ponta, incluindo a cadeia de consequências descrita no comentário:

1. `NfeGateway.ts:115` usava `Number.parseFloat(asText(prod.qCom))` sem validação.
2. `NoteItem.ts:15` guarda com `expectedQty <= 0`; `NaN <= 0` é `false`, então o item era
   construído com `expectedQty = NaN`.
3. `NoteItem.isPending()` (`confirmedQty < NaN`) é sempre `false` → `InvoiceNote.hasPendingItems()`
   (`InvoiceNote.ts:46`) nunca vê o item e `isFullyConfirmed()` (`InvoiceNote.ts:42`) dá a nota como
   completa.
4. `getMissingQty()` devolve `Math.max(NaN - n, 0)` = `NaN`, e o filtro `item.missingQty > 0` em
   `DivergenceReport.ts:78` descarta `NaN` → o item também não aparece no relatório de divergência.

O caminho de produção foi confirmado: `SearchNote.ts:51` repassa `item.quantidade` direto como
`expectedQty` para `notes.create(...)`, ou seja, o `NaN` chega ao domínio e à persistência sem
nenhuma barreira intermediária.

### Correção aplicada

Validação na fronteira, em `NfeGatewayHttp.parse()`:

- `parseQuantidade()` rejeita quantidade não finita ou `<= 0`.
- `parseCProd()` rejeita `cProd` vazio (sem ele a bipagem não casa com o item esperado, ADR-002).
- As mensagens de erro citam o `nItem` do `det` (com fallback para a posição) para tornar a nota
  problemática diagnosticável.

Duas decisões que valem registro:

- **Erro reutilizado em vez de classe nova.** O comentário sugeria `NfeNotFoundError` ou um novo
  `NfeInvalidDataError`. `NfeNotFoundError` (404) seria semanticamente errado — a nota existe, os
  dados é que vieram corrompidos. Criar `NfeInvalidDataError` exigiria editar `DomainErrors.ts` e
  `ErrorFilter.ts`, ambos fora dos arquivos em escopo deste batch, para chegar ao mesmo status HTTP.
  Foi usado `NfeServiceUnavailableError`, que `ErrorFilter.ts:37` já mapeia para **502 Bad Gateway** —
  exatamente a semântica de "o upstream devolveu uma resposta inválida". Toda a mudança ficou contida
  em `backend/src/infra/gateway/NfeGateway.ts`.
- **`Number` em vez de `parseFloat`.** `parseFloat("8,5000")` devolve `8` silenciosamente, trocando a
  quantidade por outra plausível — pior que `NaN`, porque não deixa rastro. `Number` rejeita lixo à
  direita e cai na mesma guarda.

`NoteItem` continua com a guarda fraca (`expectedQty <= 0` não pega `NaN`). Não foi alterada por
estar fora dos arquivos em escopo; fica como defesa em profundidade a considerar num round futuro,
sem impacto no vetor real, que era a fronteira não confiável fechada aqui.

### Testes

`test/unit/NfeGatewayHttp.test.ts`: 7 casos novos (`qCom` ausente / vazia / não numérica / zero /
negativa / `"8,5000"`, e `cProd` vazio), mais um caso positivo garantindo que quantidade fracionária
legítima (2.5) continua aceita. Ciclo red-green verificado: os 7 casos falham contra o código
anterior e passam com a correção.

### Verificação

- `npm run typecheck` (workspaces + e2e): exit 0.
- `npm run build` (workspaces): exit 0.
- `backend`: 43 testes passando em 7 arquivos (unit + `test/integration/nfe-gateway.test.ts`);
  `frontend`: 28 passando.
- **Pendência de ambiente, pré-existente:** os 4 arquivos em `backend/test/integration` que precisam
  de Postgres falham com `ECONNREFUSED 127.0.0.1:5432`. Não há Docker nem Postgres local nesta
  máquina. Confirmado como não relacionado: revertendo a correção, o resultado é idêntico
  (4 failed / 1 passed, mesmo erro de conexão). Falham no `beforeAll`, em
  `CREATE SCHEMA IF NOT EXISTS "drizzle"`, antes de qualquer código de parsing rodar.
