import { Inject, Injectable, Logger } from "@nestjs/common";
import { ForbiddenError, NotFoundError } from "../../domain/error/DomainErrors";
import { SessionRevocationStore } from "../../infra/auth/SessionRevocationStore";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = { id: string };

export type Output = { id: string; active: false };

export const ADMIN_CANNOT_BE_DEACTIVATED = "A conta admin não pode ser desativada";

@Injectable()
export default class DeactivateUser {
  private readonly logger = new Logger(DeactivateUser.name);

  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    private readonly revocations: SessionRevocationStore,
  ) {}

  async execute(input: Input): Promise<Output> {
    await this.unitOfWork.run(async ({ users }) => {
      const target = await users.findById(input.id);
      if (target === null) throw new NotFoundError("Usuário não encontrado");
      // Existe exatamente um admin e a rota é admin-only: esta checagem cobre tanto a
      // autodesativação quanto qualquer chamada direta à API (US-013).
      if (target.role === "admin") throw new ForbiddenError(ADMIN_CANNOT_BE_DEACTIVATED);
      await users.setActive(input.id, false);
    });
    // Corte imediato de acesso: a sessão já aberta para de valer sem esperar o token
    // expirar sozinho (ADR-005, US-007.EC-1).
    this.revocations.revoke(input.id);
    this.logger.log(`Usuário ${input.id} desativado; sessões em aberto revogadas`);
    return { id: input.id, active: false };
  }
}
