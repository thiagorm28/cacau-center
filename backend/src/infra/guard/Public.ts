import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Dispensa o `AuthGuard` global — usado apenas em `POST /auth/login`. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
