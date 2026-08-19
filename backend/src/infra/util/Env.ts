/** Base pública da API interna da Cacau Show (ADR-011); sobrescrevível para fixtures. */
export const DEFAULT_NFE_BASE_URL = "http://hybrisreports.cacaushow.com.br";

export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
};

export const optionalEnv = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value;
};
