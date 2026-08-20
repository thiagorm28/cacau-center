import { useCallback, useEffect, useState } from "react";
import {
  createUser,
  deactivateUser,
  listUsers,
  reactivateUser,
  resetUserPassword,
  updateUser,
} from "../../api/client";
import type { UserListItem, UserRole } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { Card } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { PillButton } from "../../components/ui/PillButton";
import { Screen } from "../../components/ui/Screen";
import { useSession } from "../../session/SessionContext";
import { UserFormDialog } from "./UserFormDialog";
import type { UserFormValues } from "./UserFormDialog";
import { initialPasswordFor } from "./initialPassword";

const ROLE_LABEL: Record<UserRole, string> = {
  operador: "Operador",
  gerente: "Gerente",
  admin: "Admin",
};

/** Os dois estados precisam ser diferenciáveis de relance (US-005.AC-2). */
const STATUS_STYLE = {
  active: "bg-accent-100 text-accent-700",
  inactive: "bg-choc-700 text-cream-1",
} as const;

type Confirmation = "deactivate" | "reactivate" | "reset";

type Modal =
  | { kind: "create" }
  | { kind: "edit"; user: UserListItem }
  | { kind: Confirmation; user: UserListItem }
  | null;

const CONFIRMATION_COPY: Record<
  Confirmation,
  { title: string; description: (user: UserListItem) => string; action: string }
> = {
  deactivate: {
    title: "Desativar usuário?",
    description: (user) =>
      `${user.name} deixa de conseguir entrar no sistema. O histórico de notas e bipagens já registrado por ${user.name} continua intacto.`,
    action: "Desativar",
  },
  reactivate: {
    title: "Reativar usuário?",
    description: (user) =>
      `${user.name} volta a conseguir entrar, com a mesma senha de antes da desativação.`,
    action: "Reativar",
  },
  reset: {
    title: "Resetar a senha?",
    description: (user) =>
      `A senha de ${user.name} volta a ser a inicial e precisará ser trocada no próximo acesso.`,
    action: "Resetar senha",
  },
};

const messageFor = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message !== "" ? error.message : fallback;

/**
 * Gestão de contas da loja, exclusiva do admin (US-005 a US-009, US-012).
 *
 * A listagem segue o mesmo padrão do histórico — um `Card` por linha, sem tabela: o
 * produto é mobile-first e não existe componente de tabela no projeto.
 */
export function UsersScreen() {
  const { user: currentUser } = useSession();
  const [users, setUsers] = useState<readonly UserListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (cause: unknown) {
      setError(messageFor(cause, "Não foi possível carregar os usuários."));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openModal = (next: Modal) => {
    setFormError(null);
    setNotice(null);
    setError(null);
    setModal(next);
  };

  /** Toda ação segue o mesmo roteiro: executa, recarrega a lista e fecha o diálogo. */
  const run = async (operation: () => Promise<void>, onDone: () => void, fallback: string) => {
    setIsSubmitting(true);
    try {
      await operation();
      await refresh();
      onDone();
      setModal(null);
    } catch (cause: unknown) {
      const message = messageFor(cause, fallback);
      if (modal?.kind === "create" || modal?.kind === "edit") setFormError(message);
      else {
        setError(message);
        setModal(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitForm = (values: UserFormValues) => {
    if (modal?.kind === "edit") {
      const { user } = modal;
      void run(
        async () => {
          await updateUser(user.id, {
            name: values.name,
            birthDate: values.birthDate,
            role: values.role,
          });
        },
        () => setNotice(`Dados de ${values.name} atualizados.`),
        "Não foi possível salvar as alterações.",
      );
      return;
    }
    void run(
      async () => {
        await createUser({
          name: values.name,
          email: values.email,
          cpf: values.cpf,
          birthDate: values.birthDate,
          role: values.role,
        });
      },
      // A senha inicial é comunicada pessoalmente ao funcionário (PRD — Fluxos 1 e 4):
      // sem exibi-la aqui, o admin cadastra uma conta que ninguém consegue acessar.
      () =>
        setNotice(
          `${values.name} cadastrado. Senha inicial: ${initialPasswordFor(values.cpf, values.birthDate)}`,
        ),
      "Não foi possível cadastrar o usuário.",
    );
  };

  const confirm = (kind: Confirmation, user: UserListItem) => {
    if (kind === "deactivate") {
      void run(
        () => deactivateUser(user.id),
        () => setNotice(`${user.name} foi desativado.`),
        "Não foi possível desativar o usuário.",
      );
      return;
    }
    if (kind === "reactivate") {
      void run(
        () => reactivateUser(user.id),
        () => setNotice(`${user.name} foi reativado.`),
        "Não foi possível reativar o usuário.",
      );
      return;
    }
    void run(
      () => resetUserPassword(user.id),
      () =>
        setNotice(
          `Senha de ${user.name} resetada. Senha inicial: ${initialPasswordFor(user.cpf, user.birthDate)}`,
        ),
      "Não foi possível resetar a senha.",
    );
  };

  return (
    <Screen title="Usuários" subtitle="Contas de operador e gerente da loja">
      <div className="flex flex-col gap-4">
        <PillButton fullWidth onClick={() => openModal({ kind: "create" })}>
          Cadastrar usuário
        </PillButton>
        {notice === null ? null : <Banner tone="success">{notice}</Banner>}
        {error === null ? null : <Banner tone="error">{error}</Banner>}
        {users === null ? null : users.length === 0 ? (
          <p className="text-item text-choc-600">Nenhum usuário cadastrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {users.map((user) => (
              <li key={user.id}>
                <UserRow
                  user={user}
                  // A conta admin não é editável nem desativável pelo backend (ADR-001,
                  // US-013): a linha do próprio admin não oferece essas ações.
                  isSelf={user.id === currentUser?.id || user.role === "admin"}
                  onEdit={() => openModal({ kind: "edit", user })}
                  onConfirm={(kind) => openModal({ kind, user })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal === null ? null : modal.kind === "create" || modal.kind === "edit" ? (
        <UserFormDialog
          key={modal.kind === "edit" ? modal.user.id : "create"}
          {...(modal.kind === "edit" ? { user: modal.user } : {})}
          isSubmitting={isSubmitting}
          error={formError}
          onSubmit={submitForm}
          onCancel={() => setModal(null)}
        />
      ) : (
        <ConfirmDialog
          kind={modal.kind}
          user={modal.user}
          isSubmitting={isSubmitting}
          onConfirm={() => confirm(modal.kind, modal.user)}
          onCancel={() => setModal(null)}
        />
      )}
    </Screen>
  );
}

interface UserRowProps {
  user: UserListItem;
  isSelf: boolean;
  onEdit: () => void;
  onConfirm: (kind: Confirmation) => void;
}

function UserRow({ user, isSelf, onEdit, onConfirm }: UserRowProps) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-item font-semibold text-text">{user.name}</span>
        <span
          className={`rounded-pill px-3 py-1 text-meta font-semibold ${
            user.active ? STATUS_STYLE.active : STATUS_STYLE.inactive
          }`}
        >
          {user.active ? "Ativo" : "Desativado"}
        </span>
      </div>
      <p className="mt-1 text-meta text-choc-600">
        {ROLE_LABEL[user.role]} · {user.email}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {isSelf ? null : (
          <PillButton variant="secondary" onClick={onEdit}>
            Editar
          </PillButton>
        )}
        <PillButton variant="secondary" onClick={() => onConfirm("reset")}>
          Resetar senha
        </PillButton>
        {isSelf ? null : user.active ? (
          <PillButton variant="ghost" onClick={() => onConfirm("deactivate")}>
            Desativar
          </PillButton>
        ) : (
          <PillButton variant="ghost" onClick={() => onConfirm("reactivate")}>
            Reativar
          </PillButton>
        )}
      </div>
    </Card>
  );
}

interface ConfirmDialogProps {
  kind: Confirmation;
  user: UserListItem;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Toda ação destrutiva ou irreversível passa por uma confirmação explícita. */
function ConfirmDialog({ kind, user, isSubmitting, onConfirm, onCancel }: ConfirmDialogProps) {
  const copy = CONFIRMATION_COPY[kind];
  return (
    <Dialog title={copy.title} description={copy.description(user)}>
      <div className="flex flex-col gap-3">
        <PillButton fullWidth onClick={onConfirm} disabled={isSubmitting}>
          {copy.action}
        </PillButton>
        <PillButton variant="ghost" fullWidth onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </PillButton>
      </div>
    </Dialog>
  );
}
