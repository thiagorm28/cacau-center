import { Inject, Injectable, Logger } from "@nestjs/common";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";
import ApplyScanEvent from "./ApplyScanEvent";

export type Input = {
  operatorId: string;
  events: ReadonlyArray<{
    clientEventId: string;
    scannedCode: string;
    scannedAt: string;
    manualItemId?: string;
    markUnidentified?: boolean;
  }>;
};

export type Output = { applied: number; duplicates: number };

@Injectable()
export default class SyncScanEvents {
  private readonly logger = new Logger(SyncScanEvents.name);

  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    @Inject(ApplyScanEvent) private readonly applyScanEvent: ApplyScanEvent,
  ) {}

  /**
   * Aplica o lote na ordem exata do array — que é a ordem real de bipagem do único
   * dispositivo ativo (ADR-010) — uma transação por evento, idempotente por
   * `clientEventId`.
   */
  async execute(input: Input): Promise<Output> {
    let applied = 0;
    let duplicates = 0;
    for (const event of input.events) {
      const result = await this.unitOfWork.run((repositories) =>
        this.applyScanEvent.applyWithin(repositories, {
          clientEventId: event.clientEventId,
          scannedCode: event.scannedCode,
          scannedAt: event.scannedAt,
          operatorId: input.operatorId,
          ...(event.manualItemId === undefined ? {} : { manualItemId: event.manualItemId }),
          ...(event.markUnidentified === undefined
            ? {}
            : { markUnidentified: event.markUnidentified }),
        }),
      );
      if (result.duplicate) duplicates += 1;
      else applied += 1;
    }
    this.logger.log(`Lote sincronizado: applied=${applied} duplicates=${duplicates}`);
    return { applied, duplicates };
  }
}
