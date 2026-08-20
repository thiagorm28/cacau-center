import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "../../domain/error/DomainErrors";
import { initialPasswordFor } from "../../domain/service/InitialPassword";
import { assertPasswordPolicy } from "../../domain/service/PasswordPolicy";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";
import type { PasswordHasher } from "../../infra/util/PasswordHasher";

export type Input = { userId: string; newPassword: string; confirmPassword: string };

export const PASSWORDS_DO_NOT_MATCH = "As senhas não coincidem";
export const SAME_AS_INITIAL_PASSWORD = "A nova senha deve ser diferente da senha inicial";

/**
 * Troca self-service que encerra a obrigatoriedade de ADR-002. Todo erro aqui é um
 * `Error` puro: o filtro global traduz para 422, como o contrato de API exige.
 */
@Injectable()
export default class ChangeInitialPassword {
  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    @Inject("PasswordHasher") private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: Input): Promise<void> {
    if (input.newPassword !== input.confirmPassword) throw new Error(PASSWORDS_DO_NOT_MATCH);
    assertPasswordPolicy(input.newPassword);
    await this.unitOfWork.run(async ({ users }) => {
      const account = await users.findById(input.userId);
      if (account === null) throw new NotFoundError("Usuário não encontrado");
      // A senha inicial é derivável do CPF e da data de nascimento: mantê-la esvaziaria
      // o propósito da troca obrigatória (US-010.EC-1).
      if (input.newPassword === initialPasswordFor(account.cpf, account.birthDate)) {
        throw new Error(SAME_AS_INITIAL_PASSWORD);
      }
      await users.setPassword(input.userId, await this.passwordHasher.hash(input.newPassword), false);
    });
  }
}
