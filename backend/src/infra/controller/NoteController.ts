import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import FinalizeNote from "../../application/usecase/FinalizeNote";
import GetNote from "../../application/usecase/GetNote";
import GetNoteReport from "../../application/usecase/GetNoteReport";
import ListNoteHistory from "../../application/usecase/ListNoteHistory";
import ListNotes from "../../application/usecase/ListNotes";
import SearchNote from "../../application/usecase/SearchNote";
import type { SessionUser } from "../../domain/SessionUser";
import { NotFoundError } from "../../domain/error/DomainErrors";
import { Roles } from "../guard/Roles";
import { CurrentUser } from "./CurrentUser";
import { CreateNoteDto, FinalizeNoteDto, ListNotesQueryDto, NoteHistoryQueryDto } from "./dto/NoteDto";

/** Um id fora do formato UUID nunca corresponde a uma nota — responde 404, não 400. */
const noteIdParam = () =>
  new ParseUUIDPipe({ exceptionFactory: () => new NotFoundError("Nota não encontrada") });

@Controller("notes")
export class NoteController {
  constructor(
    @Inject(SearchNote) private readonly searchNote: SearchNote,
    @Inject(ListNotes) private readonly listNotes: ListNotes,
    @Inject(GetNote) private readonly getNote: GetNote,
    @Inject(FinalizeNote) private readonly finalizeNote: FinalizeNote,
    @Inject(GetNoteReport) private readonly getNoteReport: GetNoteReport,
    @Inject(ListNoteHistory) private readonly listNoteHistory: ListNoteHistory,
  ) {}

  @Roles("operador")
  @Post()
  create(@Body() body: CreateNoteDto, @CurrentUser() user: SessionUser) {
    return this.searchNote.execute({
      invoiceNumber: body.invoiceNumber,
      operatorId: user.userId,
    });
  }

  @Roles("operador")
  @Get()
  list(@Query() query: ListNotesQueryDto) {
    return this.listNotes.execute(query.status === undefined ? {} : { status: query.status });
  }

  // Precisa vir antes de `:id`, senão "history" seria capturado como um id de nota.
  @Roles("gerente")
  @Get("history")
  history(@Query() query: NoteHistoryQueryDto) {
    return this.listNoteHistory.execute({
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.from === undefined ? {} : { from: query.from }),
      ...(query.to === undefined ? {} : { to: query.to }),
    });
  }

  @Get(":id")
  detail(@Param("id", noteIdParam()) noteId: string) {
    return this.getNote.execute({ noteId });
  }

  @Roles("operador")
  @Post(":id/finalize")
  @HttpCode(200)
  finalize(
    @Param("id", noteIdParam()) noteId: string,
    @Body() body: FinalizeNoteDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.finalizeNote.execute({
      noteId,
      operatorId: user.userId,
      confirmIncomplete: body.confirmIncomplete === true,
    });
  }

  @Get(":id/report")
  report(@Param("id", noteIdParam()) noteId: string) {
    return this.getNoteReport.execute({ noteId });
  }
}
