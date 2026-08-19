import { Inject, Injectable, Logger } from "@nestjs/common";
import type { SessionUser } from "../../domain/SessionUser";
import { UnauthorizedError } from "../../domain/error/DomainErrors";
import type { TokenGenerator } from "../../infra/auth/TokenGenerator";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";
import type { PasswordHasher } from "../../infra/util/PasswordHasher";

export type Input = { email: string; password: string };

export type Output = { user: SessionUser; token: string; ttlInSeconds: number };

/** Mesma mensagem para e-mail inexistente e senha errada: não revela se a conta existe. */
const INVALID_CREDENTIALS = "Credenciais inválidas";

@Injectable()
export default class Login {
  private readonly logger = new Logger(Login.name);

  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    @Inject("PasswordHasher") private readonly passwordHasher: PasswordHasher,
    @Inject("TokenGenerator") private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(input: Input): Promise<Output> {
    const account = await this.unitOfWork.run(({ users }) => users.findByEmail(input.email));
    if (account === null) {
      this.logger.warn(`Login recusado para ${input.email}: conta inexistente`);
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }
    const matches = await this.passwordHasher.compare(input.password, account.passwordHash);
    if (!matches) {
      this.logger.warn(`Login recusado para ${input.email}: senha incorreta`);
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }
    const user: SessionUser = {
      userId: account.userId,
      name: account.name,
      email: account.email,
      role: account.role,
    };
    return {
      user,
      token: await this.tokenGenerator.generate(user),
      ttlInSeconds: this.tokenGenerator.ttlInSeconds(),
    };
  }
}
