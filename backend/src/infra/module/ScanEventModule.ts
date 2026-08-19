import { Module } from "@nestjs/common";
import ApplyScanEvent from "../../application/usecase/ApplyScanEvent";
import SyncScanEvents from "../../application/usecase/SyncScanEvents";
import { ScanEventController } from "../controller/ScanEventController";

@Module({
  controllers: [ScanEventController],
  providers: [ApplyScanEvent, SyncScanEvents],
})
export class ScanEventModule {}
