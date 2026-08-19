import { useState } from "react";
import type { FormEvent } from "react";
import { Banner } from "../../components/ui/Banner";
import { PillButton } from "../../components/ui/PillButton";
import { Screen } from "../../components/ui/Screen";
import { useSession } from "../../session/SessionContext";

const FIELD =
  "w-full rounded-pill bg-surface px-5 py-3 text-item text-text shadow-sm outline-none placeholder:text-cream-3 focus:ring-2 focus:ring-accent";

export function LoginScreen() {
  const { signIn, expired } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      // Mensagem genérica: não revela se o e-mail existe (US-015.EC-1).
      setError("E-mail ou senha inválidos");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen title="Conferência de notas" subtitle="Entre com sua conta da loja">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="section-label text-choc-600" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          autoComplete="username"
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD}
        />
        <label className="section-label text-choc-600" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD}
        />
        {expired && error === null ? (
          // Metade "solicitado a autenticar novamente" da US-015.EC-2: sem esta mensagem, o
          // operador só vê a tela de login reaparecer, sem saber que as bipagens pendentes
          // continuam guardadas esperando o próximo login para sincronizar.
          <Banner tone="warning">
            Sua sessão expirou. Entre novamente para continuar — as bipagens pendentes foram
            guardadas.
          </Banner>
        ) : null}
        {error === null ? null : <Banner tone="error">{error}</Banner>}
        <PillButton type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </PillButton>
      </form>
    </Screen>
  );
}
