import { Inject, Injectable, Logger } from "@nestjs/common";
import { type ScanResolution, resolveScan } from "shared";
import type InvoiceNote from "../../domain/entity/InvoiceNote";
import type ScanEvent from "../../domain/entity/ScanEvent";
import type { ScanEventResult } from "../../domain/entity/ScanEvent";
import { NotFoundError } from "../../domain/error/DomainErrors";
import type { Repositories, UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = {
  clientEventId: string;
  scannedCode: string;
  scannedAt: string;
  operatorId: string;
  manualItemId?: string;
  markUnidentified?: boolean;
};

export type Output = { resolution: ScanResolution };

export type AppliedScan = { resolution: ScanResolution; duplicate: boolean };

type PlannedScan = { resolution: ScanResolution; result: ScanEventResult; note?: InvoiceNote };

/**
 * Janela em que uma nota já concluída continua valendo como candidata a `exceeded`.
 * A rebipagem por engano acontece segundos depois da caixa anterior, não horas: a janela
 * preserva o aviso de "quantidade já atingida" durante a conferência em curso sem deixar
 * uma nota antiga capturar caixas de uma entrega futura — essas devem mesmo cair no fluxo
 * de caixa não identificada (US-007).
 */
const RECENTLY_COMPLETED_WINDOW_MS = 30 * 60 * 1000;

/** Reconstrói a resolução já gravada, para responder um `clientEventId` repetido. */
const toResolution = (event: ScanEvent): ScanResolution => {
  if (event.result === "unidentified") return { kind: "unidentified" };
  if (event.noteId === null || event.noteItemId === null) return { kind: "unidentified" };
  const kind = event.result === "exceeded" ? "exceeded" : "matched";
  return { kind, noteId: event.noteId, itemId: event.noteItemId };
};

@Injectable()
export default class ApplyScanEvent {
  private readonly logger = new Logger(ApplyScanEvent.name);

  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  async execute(input: Input): Promise<Output> {
    const applied = await this.unitOfWork.run((repositories) =>
      this.applyWithin(repositories, input),
    );
    return { resolution: applied.resolution };
  }

  /**
   * Aplica uma bipagem com os repositórios já ligados a uma transação — leitura das notas
   * abertas e escrita do evento/contador acontecem no mesmo escopo transacional
   * (ADR-007). Reutilizado por `SyncScanEvents` para cada evento do lote.
   */
  async applyWithin(repositories: Repositories, input: Input): Promise<AppliedScan> {
    const existing = await repositories.scanEvents.findByClientEventId(input.clientEventId);
    if (existing !== null) {
      return { resolution: toResolution(existing), duplicate: true };
    }
    const openNotes = await repositories.notes.listOpen();
    // A fila vazia só recusa a bipagem depois do planejamento: quando a única nota da fila
    // acabou de concluir sozinha, `planExceededOnCompleted` ainda transforma a rebipagem de
    // um item confirmado no aviso de "quantidade já atingida" (US-005 AC-1). Sem nenhuma nota
    // para responder, a recusa continua valendo — e é ela que impede um evento `unidentified`
    // órfão de ser reivindicado (`claimUnidentified`) por uma entrega futura (US-007.EC-2).
    const plannedScan = await this.plan(repositories, openNotes, input);
    if (openNotes.length === 0 && plannedScan.result === "unidentified") {
      throw new Error("nenhuma conferência ativa");
    }
    const planned = await this.settle(repositories, plannedScan, input.operatorId);
    const noteId = planned.resolution.kind === "unidentified" ? null : planned.resolution.noteId;
    const itemId = planned.resolution.kind === "unidentified" ? null : planned.resolution.itemId;
    await repositories.scanEvents.create({
      clientEventId: input.clientEventId,
      scannedCode: input.scannedCode,
      result: planned.result,
      noteId,
      noteItemId: itemId,
      scannedBy: input.operatorId,
      scannedAt: new Date(input.scannedAt),
    });
    this.logger.log(`Bipagem ${input.scannedCode} resolvida como ${planned.result}`);
    return { resolution: planned.resolution, duplicate: false };
  }

  private async plan(
    repositories: Repositories,
    openNotes: readonly InvoiceNote[],
    input: Input,
  ): Promise<PlannedScan> {
    if (input.manualItemId !== undefined) return this.planManual(openNotes, input.manualItemId);
    if (input.markUnidentified === true) {
      return { resolution: { kind: "unidentified" }, result: "unidentified" };
    }
    const resolution = resolveScan(
      openNotes.map((note) => note.toPendingNote()),
      input.scannedCode,
    );
    if (resolution.kind === "unidentified") {
      return this.planExceededOnCompleted(repositories, input.scannedCode);
    }
    const note = openNotes.find((candidate) => candidate.noteId === resolution.noteId);
    return {
      resolution,
      result: resolution.kind === "exceeded" ? "exceeded" : "matched",
      ...(note === undefined ? {} : { note }),
    };
  }

  /**
   * Segunda passada sobre as notas concluídas há pouco, antes de desistir para
   * `unidentified`. Sair do rateio de novas bipagens ao completar (US-010 AC-2) não
   * apaga o fato de que os itens daquela nota seguem 100% confirmados: rebipar uma caixa
   * dela é "quantidade já atingida" (US-005 AC-1), e não uma caixa sem dono. Sem esta
   * passada, a conclusão automática trocaria o aviso simples de excedente pelo fluxo de
   * seleção manual / caixa não identificada no instante em que a última caixa entra.
   *
   * Só o ramo `exceeded` do `resolveScan` é aproveitado: creditar uma bipagem a uma nota
   * já concluída violaria US-010 AC-2, então nenhum `matched` escapa desta pool mesmo que
   * uma nota `completed` aparecesse com item pendente.
   */
  private async planExceededOnCompleted(
    repositories: Repositories,
    scannedCode: string,
  ): Promise<PlannedScan> {
    const unidentified: PlannedScan = {
      resolution: { kind: "unidentified" },
      result: "unidentified",
    };
    const completedNotes = await repositories.notes.list({
      statuses: ["completed"],
      closedFrom: new Date(Date.now() - RECENTLY_COMPLETED_WINDOW_MS),
    });
    if (completedNotes.length === 0) return unidentified;
    const resolution = resolveScan(
      completedNotes.map((note) => note.toPendingNote()),
      scannedCode,
    );
    if (resolution.kind !== "exceeded") return unidentified;
    const note = completedNotes.find((candidate) => candidate.noteId === resolution.noteId);
    return { resolution, result: "exceeded", ...(note === undefined ? {} : { note }) };
  }

  private planManual(openNotes: readonly InvoiceNote[], manualItemId: string): PlannedScan {
    const note = openNotes.find((candidate) => candidate.findItem(manualItemId) !== undefined);
    if (note === undefined) throw new NotFoundError("Item não encontrado nas notas em conferência");
    const item = note.findItem(manualItemId) as NonNullable<ReturnType<InvoiceNote["findItem"]>>;
    if (!item.isPending()) {
      return {
        resolution: { kind: "exceeded", noteId: note.noteId, itemId: manualItemId },
        result: "exceeded",
        note,
      };
    }
    return {
      resolution: { kind: "matched", noteId: note.noteId, itemId: manualItemId },
      result: "manual_matched",
      note,
    };
  }

  /**
   * Fecha o plano contra o banco antes de gravar o evento. `plan` decide sobre o snapshot
   * lido no início da transação, que pode estar vencido: uma bipagem concorrente do mesmo
   * item pode ter gasto a última unidade nesse intervalo. O incremento guardado do
   * repositório é a autoridade sobre o limite de quantidade — quando ele não credita nada,
   * a bipagem vira `exceeded` aqui e já é gravada com o resultado correto.
   */
  private async settle(
    repositories: Repositories,
    planned: PlannedScan,
    operatorId: string,
  ): Promise<PlannedScan> {
    if (planned.result !== "matched" && planned.result !== "manual_matched") return planned;
    const { noteId, itemId } = planned.resolution as Extract<ScanResolution, { kind: "matched" }>;
    const confirmed = await repositories.notes.incrementConfirmedQty(itemId);
    if (!confirmed) {
      return {
        ...planned,
        resolution: { kind: "exceeded", noteId, itemId },
        result: "exceeded",
      };
    }
    await this.confirmBox(repositories, planned, itemId, operatorId);
    return planned;
  }

  /** Reflete no agregado a caixa que o banco acabou de creditar e conclui a nota (US-010). */
  private async confirmBox(
    repositories: Repositories,
    planned: PlannedScan,
    itemId: string,
    operatorId: string,
  ): Promise<void> {
    const note = planned.note;
    if (note === undefined) return;
    note.findItem(itemId)?.confirmOneBox();
    // A conclusão automática relê o agregado dentro da transação em vez de olhar o
    // snapshot do início: sob READ COMMITTED cada statement enxerga o que já foi
    // commitado, então esta leitura inclui as caixas creditadas por bipagens concorrentes
    // — inclusive a que esta transação acabou de gravar e ainda não commitou.
    const persisted = await repositories.notes.findById(note.noteId);
    if (persisted === null || !persisted.isFullyConfirmed()) return;
    await this.closeCompleted(repositories, note, operatorId);
  }

  /**
   * Atingir 100% já é o fechamento da nota — não uma transição de status à espera de
   * alguém abrir o relatório. Gravar `closedBy`/`closedAt` aqui mantém a rastreabilidade
   * exigida por ADR-004/US-016 mesmo que o operador nunca volte à nota, e reivindicar as
   * caixas não identificadas em aberto neste instante evita que elas sejam atribuídas a
   * outra nota finalizada depois (US-010 EC-2). `FinalizeNote` continua idempotente:
   * o ramo que reivindica só roda enquanto `closedAt` for nulo.
   */
  private async closeCompleted(
    repositories: Repositories,
    note: InvoiceNote,
    operatorId: string,
  ): Promise<void> {
    const closedAt = new Date();
    note.markCompleted();
    note.close(operatorId, closedAt);
    await repositories.notes.close(note.noteId, "completed", operatorId, closedAt);
    await repositories.scanEvents.claimUnidentified(note.noteId);
  }
}
