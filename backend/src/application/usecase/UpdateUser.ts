import { Inject, Injectable } from "@nestjs/common";
import { ForbiddenError, NotFoundError } from "../../domain/error/DomainErrors";
import type { Repositories, UnitOfWork } from "../../infra/database/UnitOfWork";
import { type UserListItem, toUserListItem } from "./ListUsers";

export type Input = {
  id: string;
  name: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  role: "operador" | "gerente";
};

export type Output = UserListItem;

/** CPF e e-mail não são editáveis por regra de negócio do PRD — não há campo para eles. */
@Injectable()
export default class UpdateUser {
  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  execute(input: Input): Promise<Output> {
    return this.unitOfWork.run((repositories) => this.updateWithin(repositories, input));
  }

  private async updateWithin(repositories: Repositories, input: Input): Promise<Output> {
    const target = await repositories.users.findById(input.id);
    if (target === null) throw new NotFoundError("Usuário não encontrado");
    // Espelha `DeactivateUser`: a conta admin é provisionada fora da aplicação e não é
    // administrável por esta rota (ADR-001).
    if (target.role === "admin") throw new ForbiddenError("A conta admin não pode ser editada");
    const updated = await repositories.users.update(input.id, {
      name: input.name,
      birthDate: input.birthDate,
      role: input.role,
    });
    return toUserListItem(updated);
  }
}
