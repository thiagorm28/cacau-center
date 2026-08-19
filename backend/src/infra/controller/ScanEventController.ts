import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import ApplyScanEvent from "../../application/usecase/ApplyScanEvent";
import SyncScanEvents from "../../application/usecase/SyncScanEvents";
import type { SessionUser } from "../../domain/SessionUser";
import { Roles } from "../guard/Roles";
import { CurrentUser } from "./CurrentUser";
import { ScanEventDto, SyncScanEventsDto } from "./dto/ScanEventDto";

@Roles("operador")
@Controller("scan-events")
export class ScanEventController {
  constructor(
    @Inject(ApplyScanEvent) private readonly applyScanEvent: ApplyScanEvent,
    @Inject(SyncScanEvents) private readonly syncScanEvents: SyncScanEvents,
  ) {}

  @Post()
  @HttpCode(200)
  apply(@Body() body: ScanEventDto, @CurrentUser() user: SessionUser) {
    return this.applyScanEvent.execute({
      clientEventId: body.clientEventId,
      scannedCode: body.scannedCode,
      scannedAt: body.scannedAt,
      operatorId: user.userId,
      ...(body.manualItemId === undefined ? {} : { manualItemId: body.manualItemId }),
      ...(body.markUnidentified === undefined
        ? {}
        : { markUnidentified: body.markUnidentified }),
    });
  }

  @Post("sync")
  @HttpCode(200)
  sync(@Body() body: SyncScanEventsDto, @CurrentUser() user: SessionUser) {
    return this.syncScanEvents.execute({ operatorId: user.userId, events: body.events });
  }
}
