import { Inject, Injectable } from "@nestjs/common";
import type { Role } from "../../domain/SessionUser";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";
import type { UserRecord } from "../../infra/repository/UserRepository";

/**
 * Campos suficientes para a listagem (nome/papel/status) e para pré-preencher o
 * formulário de edição (data de nascimento), sem uma segunda chamada. `passwordHash`
 * nunca sai daqui.
 */
export type UserListItem = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
};

export type Output = { users: UserListItem[] };

export const toUserListItem = (record: UserRecord): UserListItem => ({
  id: record.userId,
  name: record.name,
  email: record.email,
  cpf: record.cpf,
  birthDate: record.birthDate,
  role: record.role,
  active: record.active,
  mustChangePassword: record.mustChangePassword,
});

@Injectable()
export default class ListUsers {
  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  /** Sem filtro nem paginação: o volume é de poucos funcionários por loja (TechSpec). */
  async execute(): Promise<Output> {
    const records = await this.unitOfWork.run(({ users }) => users.list());
    return { users: records.map(toUserListItem) };
  }
}
