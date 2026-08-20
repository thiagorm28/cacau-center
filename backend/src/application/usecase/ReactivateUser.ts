import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotFoundError } from "../../domain/error/DomainErrors";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = { id: string };

export type Output = { id: string; active: true };

/**
 * Reativar não mexe na senha nem no store de revogação (US-008.AC-2): um token emitido
 * no login seguinte já tem `iat` posterior à revogação e passa naturalmente.
 */
@Injectable()
export default class ReactivateUser {
  private readonly logger = new Logger(ReactivateUser.name);

  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  async execute(input: Input): Promise<Output> {
    await this.unitOfWork.run(async ({ users }) => {
      const target = await users.findById(input.id);
      if (target === null) throw new NotFoundError("Usuário não encontrado");
      await users.setActive(input.id, true);
    });
    this.logger.log(`Usuário ${input.id} reativado`);
    return { id: input.id, active: true };
  }
}
