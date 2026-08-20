import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConflictError, NotFoundError } from "../../domain/error/DomainErrors";
import { initialPasswordFor } from "../../domain/service/InitialPassword";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";
import type { PasswordHasher } from "../../infra/util/PasswordHasher";

export type Input = { id: string };

export type Output = { id: string };

export const INACTIVE_TARGET = "Reative o usuário antes de resetar a senha";

/**
 * Recoloca a senha inicial `CPF@DDMMAAAA` (ADR-002) e reabre a troca obrigatória.
 * Idempotente: duas chamadas seguidas deixam o mesmo estado final (US-009.EC-2).
 */
@Injectable()
export default class ResetPassword {
  private readonly logger = new Logger(ResetPassword.name);

  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    @Inject("PasswordHasher") private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: Input): Promise<Output> {
    await this.unitOfWork.run(async ({ users }) => {
      const target = await users.findById(input.id);
      if (target === null) throw new NotFoundError("Usuário não encontrado");
      if (!target.active) throw new ConflictError(INACTIVE_TARGET);
      const passwordHash = await this.passwordHasher.hash(
        initialPasswordFor(target.cpf, target.birthDate),
      );
      await users.setPassword(input.id, passwordHash, true);
    });
    this.logger.log(`Senha do usuário ${input.id} resetada para a senha inicial`);
    return { id: input.id };
  }
}
