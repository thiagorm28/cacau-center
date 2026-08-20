import { useState } from "react";
import type { FormEvent } from "react";
import type { AssignableRole, UserListItem } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { Dialog } from "../../components/ui/Dialog";
import { PillButton } from "../../components/ui/PillButton";

const FIELD =
  "w-full rounded-pill bg-bg px-5 py-3 text-item text-text shadow-sm outline-none placeholder:text-cream-3 focus:ring-2 focus:ring-accent disabled:opacity-60";

/**
 * As duas — e únicas — opções de perfil (ADR-001). `admin` não está aqui de propósito:
 * a conta admin é provisionada fora da aplicação e nunca nasce deste formulário.
 */
const ROLE_OPTIONS: ReadonlyArray<{ value: AssignableRole; label: string }> = [
  { value: "operador", label: "Operador" },
  { value: "gerente", label: "Gerente" },
];

export interface UserFormValues {
  name: string;
  email: string;
  cpf: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  role: AssignableRole;
}

interface UserFormDialogProps {
  /** Presente = edição; ausente = cadastro. */
  user?: UserListItem;
  isSubmitting: boolean;
  /** Erro devolvido pelo backend (CPF inválido, duplicidade) — US-004. */
  error: string | null;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}

/** Perfil só é atribuível a quem não é admin; a tela nunca abre a edição de um admin. */
const initialRole = (user: UserListItem | undefined): AssignableRole | null =>
  user === undefined || user.role === "admin" ? null : user.role;

/**
 * Cadastro (US-003) e edição (US-006) de operador/gerente. CPF e e-mail só existem no
 * cadastro: por regra de negócio do PRD eles não são editáveis, então na edição
 * aparecem travados, para o admin conferir de quem é a conta sem poder alterá-los.
 */
export function UserFormDialog({
  user,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: UserFormDialogProps) {
  const isEditing = user !== undefined;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [cpf, setCpf] = useState(user?.cpf ?? "");
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? "");
  const [role, setRole] = useState<AssignableRole | null>(initialRole(user));
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Campo obrigatório vazio bloqueia o envio antes de qualquer chamada (US-003.EC-1).
    if (name.trim() === "") return setInvalid("Informe o nome.");
    if (birthDate === "") return setInvalid("Informe a data de nascimento.");
    if (!isEditing && cpf.trim() === "") return setInvalid("Informe o CPF.");
    if (!isEditing && email.trim() === "") return setInvalid("Informe o e-mail.");
    // Nenhum perfil escolhido também bloqueia (US-003.EC-2).
    if (role === null) return setInvalid("Escolha um perfil: operador ou gerente.");
    setInvalid(null);
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      cpf: cpf.trim(),
      birthDate,
      role,
    });
  };

  return (
    <Dialog
      title={isEditing ? "Editar usuário" : "Cadastrar usuário"}
      description={
        isEditing
          ? "CPF e e-mail não são editáveis."
          : "A senha inicial é gerada a partir do CPF e da data de nascimento."
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="section-label text-choc-600" htmlFor="user-name">
          Nome
        </label>
        <input
          id="user-name"
          value={name}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          className={FIELD}
        />

        <label className="section-label text-choc-600" htmlFor="user-birth-date">
          Data de nascimento
        </label>
        <input
          id="user-birth-date"
          type="date"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          className={FIELD}
        />

        <label className="section-label text-choc-600" htmlFor="user-cpf">
          CPF
        </label>
        <input
          id="user-cpf"
          inputMode="numeric"
          autoComplete="off"
          value={cpf}
          disabled={isEditing}
          onChange={(event) => setCpf(event.target.value)}
          className={FIELD}
        />

        <label className="section-label text-choc-600" htmlFor="user-email">
          E-mail
        </label>
        <input
          id="user-email"
          type="email"
          autoComplete="off"
          value={email}
          disabled={isEditing}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD}
        />

        <fieldset className="mt-1 border-0 p-0">
          <legend className="section-label text-choc-600">Perfil</legend>
          <div className="mt-3 flex gap-3">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-pill px-5 py-3 text-item font-semibold shadow-sm ${
                  role === option.value
                    ? "bg-accent text-surface"
                    : "bg-accent-100 text-accent-700"
                }`}
              >
                <input
                  type="radio"
                  name="user-role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {invalid === null ? null : <Banner tone="error">{invalid}</Banner>}
        {error === null ? null : <Banner tone="error">{error}</Banner>}

        <div className="mt-2 flex flex-col gap-3">
          <PillButton type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar"}
          </PillButton>
          <PillButton variant="ghost" fullWidth onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </PillButton>
        </div>
      </form>
    </Dialog>
  );
}
