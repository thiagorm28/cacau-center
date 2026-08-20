import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Role } from "../../domain/SessionUser";
import { ConflictError } from "../../domain/error/DomainErrors";
import { initialPasswordFor } from "../../domain/service/InitialPassword";
import Cpf from "../../domain/valueobject/Cpf";
import type { Repositories, UnitOfWork } from "../../infra/database/UnitOfWork";
import type { PasswordHasher } from "../../infra/util/PasswordHasher";

export type Input = {
  name: string;
  email: string;
  cpf: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  role: "operador" | "gerente";
};

export type Output = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export const DUPLICATE_EMAIL = "Já existe um usuário com este e-mail";
export const DUPLICATE_CPF = "Já existe um usuário com este CPF";

/** Violação de unicidade do Postgres, atravessando o wrapper de erro do Drizzle. */
const uniqueViolationConstraint = (error: unknown): string | null => {
  let current: unknown = error;
  while (current instanceof Error) {
    const candidate = current as Error & { code?: string; constraint?: string };
    if (candidate.code === "23505") return candidate.constraint ?? "";
    current = candidate.cause;
  }
  return null;
};

@Injectable()
export default class CreateUser {
  private readonly logger = new Logger(CreateUser.name);

  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    @Inject("PasswordHasher") private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: Input): Promise<Output> {
    // Defesa em profundidade (ADR-001): o tipo já exclui "admin", mas uma chamada
    // direta ao usecase não passa pelo DTO. A conta admin só nasce pelo bootstrap.
    if ((input.role as Role) === "admin") {
      throw new Error("A conta admin não pode ser criada por esta rota");
    }
    const cpf = Cpf.create(input.cpf);
    const passwordHash = await this.passwordHasher.hash(
      initialPasswordFor(cpf.digits, input.birthDate),
    );
    const created = await this.unitOfWork.run((repositories) =>
      this.createWithin(repositories, input, cpf.digits, passwordHash),
    );
    this.logger.log(`Usuário ${created.userId} cadastrado com papel ${created.role}`);
    return {
      id: created.userId,
      name: created.name,
      email: created.email,
      role: created.role,
      active: created.active,
    };
  }

  private async createWithin(
    repositories: Repositories,
    input: Input,
    cpfDigits: string,
    passwordHash: string,
  ) {
    // Duplicidade vale para conta ativa e desativada (US-004.AC-2): a busca não filtra
    // por `active`.
    if ((await repositories.users.findByEmail(input.email)) !== null) {
      throw new ConflictError(DUPLICATE_EMAIL);
    }
    if ((await repositories.users.findByCpf(cpfDigits)) !== null) {
      throw new ConflictError(DUPLICATE_CPF);
    }
    try {
      return await repositories.users.create({
        name: input.name,
        email: input.email,
        cpf: cpfDigits,
        birthDate: input.birthDate,
        passwordHash,
        role: input.role,
        active: true,
        // Senha inicial previsível: a troca no primeiro acesso é obrigatória (ADR-002).
        mustChangePassword: true,
      });
    } catch (error: unknown) {
      // Duas requisições simultâneas passam juntas pelas checagens acima (US-004.EC-2);
      // o índice único do banco é quem decide, e a perdedora vira 409, não 500.
      const constraint = uniqueViolationConstraint(error);
      if (constraint === null) throw error;
      throw new ConflictError(constraint.includes("cpf") ? DUPLICATE_CPF : DUPLICATE_EMAIL);
    }
  }
}
