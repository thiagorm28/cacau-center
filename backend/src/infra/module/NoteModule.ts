import { Module } from "@nestjs/common";
import FinalizeNote from "../../application/usecase/FinalizeNote";
import GetNote from "../../application/usecase/GetNote";
import GetNoteReport from "../../application/usecase/GetNoteReport";
import ListNoteHistory from "../../application/usecase/ListNoteHistory";
import ListNotes from "../../application/usecase/ListNotes";
import SearchNote from "../../application/usecase/SearchNote";
import { NoteController } from "../controller/NoteController";
import NfeGatewayHttp from "../gateway/NfeGateway";
import { DEFAULT_NFE_BASE_URL, optionalEnv, requireEnv } from "../util/Env";

@Module({
  controllers: [NoteController],
  providers: [
    SearchNote,
    ListNotes,
    GetNote,
    FinalizeNote,
    GetNoteReport,
    ListNoteHistory,
    {
      provide: "NfeGateway",
      // O código da empresa é fixo por loja e nunca fica no código-fonte (ADR-011).
      useFactory: () =>
        new NfeGatewayHttp(
          optionalEnv("NFE_BASE_URL", DEFAULT_NFE_BASE_URL),
          requireEnv("EMPRESA_CODE"),
        ),
    },
  ],
})
export class NoteModule {}
