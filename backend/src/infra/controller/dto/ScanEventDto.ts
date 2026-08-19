import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class ScanEventDto {
  @IsUUID()
  clientEventId!: string;

  @IsString()
  @IsNotEmpty()
  scannedCode!: string;

  @IsISO8601()
  scannedAt!: string;

  @IsOptional()
  @IsUUID()
  manualItemId?: string;

  @IsOptional()
  @IsBoolean()
  markUnidentified?: boolean;
}

export class SyncScanEventsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ScanEventDto)
  events!: ScanEventDto[];
}
