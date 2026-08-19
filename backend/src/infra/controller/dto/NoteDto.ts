import { IsBoolean, IsISO8601, IsIn, IsOptional, IsString, Matches } from "class-validator";
import type { NoteStatus } from "../../../domain/entity/InvoiceNote";

const NOTE_STATUSES: readonly NoteStatus[] = ["open", "completed", "closed_incomplete"];

export class CreateNoteDto {
  /** Número de faturamento: só dígitos, com os zeros à esquerda preservados (ADR-005). */
  @IsString()
  @Matches(/^\d+$/, { message: "invoiceNumber deve conter apenas dígitos" })
  invoiceNumber!: string;
}

export class FinalizeNoteDto {
  @IsOptional()
  @IsBoolean()
  confirmIncomplete?: boolean;
}

export class ListNotesQueryDto {
  @IsOptional()
  @IsIn(NOTE_STATUSES)
  status?: NoteStatus;
}

export class NoteHistoryQueryDto {
  @IsOptional()
  @IsIn(["completed", "closed_incomplete"])
  status?: Extract<NoteStatus, "completed" | "closed_incomplete">;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
