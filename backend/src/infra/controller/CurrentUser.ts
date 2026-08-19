import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { SessionUser } from "../../domain/SessionUser";

/** Entrega o usuário que o `AuthGuard` anexou à requisição. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<{ user: SessionUser }>().user,
);
