import { SetMetadata } from "@nestjs/common";
import type { Role } from "../../domain/SessionUser";

export const ROLES_KEY = "roles";

/** Restringe a rota aos papéis informados; sem o decorator, qualquer papel autenticado passa. */
export const Roles = (...roles: readonly Role[]) => SetMetadata(ROLES_KEY, roles);
