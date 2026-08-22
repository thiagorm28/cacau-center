import { useState } from "react";
import type { FormEvent } from "react";
import { changePassword } from "../../api/client";
import { Banner } from "../../components/ui/Banner";
import { PasswordField } from "../../components/ui/PasswordField";
import { PillButton } from "../../components/ui/PillButton";
import { Screen } from "../../components/ui/Screen";
import { useSession } from "../../session/SessionContext";
import { LogoutButton } from "./LogoutButton";

export const PASSWORDS_DO_NOT_MATCH = "As senhas não coincidem";

interface ChangePasswordScreenProps {
  onChanged: () => void;
}

/**
 * Troca obrigatória do primeiro acesso e do pós-reset (ADR-002, US-010).
 *
 * A única regra checada aqui é a de que a confirmação bate com a nova senha, porque é a
 * única que o cliente sabe sozinho (US-010.EC-2). Política de senha e "igual à senha
 * inicial" têm um dono só, no backend: duplicá-las aqui criaria duas verdades que
 * divergiriam na primeira mudança de regra — a mensagem exibida é a que o servidor manda.
 */
export function ChangePasswordScreen({ onChanged }: ChangePasswordScreenProps) {
  const { applyUser } = useSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(PASSWORDS_DO_NOT_MATCH);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      applyUser(await changePassword({ newPassword, confirmPassword }));
      onChanged();
    } catch (cause: unknown) {
      setError(
        cause instanceof Error && cause.message !== ""
          ? cause.message
          : "Não foi possível trocar a senha.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      title="Defina uma nova senha"
      subtitle="Sua senha atual foi gerada pela loja e precisa ser trocada antes de continuar"
      header={<LogoutButton />}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordField
          id="new-password"
          label="Nova senha"
          value={newPassword}
          autoComplete="new-password"
          onChange={setNewPassword}
        />
        <p className="text-meta text-choc-600">Use ao menos 8 caracteres, com pelo menos 1 número.</p>
        <PasswordField
          id="confirm-password"
          label="Confirme a nova senha"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={setConfirmPassword}
        />
        {error === null ? null : <Banner tone="error">{error}</Banner>}
        <PillButton type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar nova senha"}
        </PillButton>
      </form>
    </Screen>
  );
}
