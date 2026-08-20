import { IsEmail, IsIn, IsNotEmpty, IsString, Matches } from "class-validator";

/**
 * Só forma e tipo. Dígito verificador do CPF, duplicidade e política de senha ficam
 * nos usecases, seguindo a convenção já usada por `NoteDto`/`AuthDto`.
 */
const ASSIGNABLE_ROLES = ["operador", "gerente"] as const;

/** `admin` nunca é atribuível por esta API (ADR-001). */
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const BIRTH_DATE_MESSAGE = "birthDate deve estar no formato YYYY-MM-DD";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: BIRTH_DATE_MESSAGE })
  birthDate!: string;

  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;
}

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: BIRTH_DATE_MESSAGE })
  birthDate!: string;

  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  newPassword!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;
}
