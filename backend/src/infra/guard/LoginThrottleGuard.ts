import { type ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";
import { optionalEnv } from "../util/Env";

/** Tentativas de login permitidas por janela, antes do 429. `0` desliga o limite. */
export const LOGIN_RATE_LIMIT = (): number =>
  Number.parseInt(optionalEnv("LOGIN_RATE_LIMIT", "5"), 10);

/** Tamanho da janela de contagem, em segundos. */
export const LOGIN_RATE_TTL_SECONDS = (): number =>
  Number.parseInt(optionalEnv("LOGIN_RATE_TTL_SECONDS", "60"), 10);

/**
 * Limita a força bruta em `POST /auth/login`.
 *
 * A chave combina IP de origem e e-mail tentado: atrás do Caddy todos os pedidos chegam
 * com o mesmo IP de rede (o `trust proxy` do Express recupera o real via
 * `X-Forwarded-For`), então contar só por IP puniria a loja inteira; contar só por
 * e-mail deixaria um atacante trancar a conta de um gerente. Com as duas partes juntas,
 * quem erra a senha de uma conta a partir de um ponto só é quem fica de castigo.
 *
 * O contador é em memória, isto é, por processo — suficiente para o deploy de instância
 * única descrito no DEPLOY.md.
 */
@Injectable()
export class LoginThrottleGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = (req.body ?? {}) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const ip = typeof req.ip === "string" ? req.ip : "desconhecido";
    return `${ip}|${email}`;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    // O corpo segue o formato `{ statusCode, message }` do ErrorFilter — é o que o
    // cliente HTTP do frontend lê para mostrar a mensagem; o `ThrottlerException` padrão
    // responde só com a string solta.
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "Muitas tentativas de login. Tente novamente em instantes.",
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
