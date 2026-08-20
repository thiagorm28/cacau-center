import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { UserRole } from "./api/types";
import { Screen } from "./components/ui/Screen";
import { ChangePasswordScreen } from "./features/auth/ChangePasswordScreen";
import { LoginScreen } from "./features/auth/LoginScreen";
import { HistoryScreen } from "./features/history/HistoryScreen";
import { NotesQueueScreen } from "./features/notes/NotesQueueScreen";
import { UsersScreen } from "./features/users/UsersScreen";
import { CHANGE_PASSWORD_PATH, RequirePasswordChange } from "./routes/RequirePasswordChange";
import { getHomePathForRole, NAV_ROUTES } from "./routes/navigation";
import { RequireRole } from "./routes/RequireRole";
import { ReportRoute } from "./routes/ReportRoute";
import { ScanRoute } from "./routes/ScanRoute";
import { useSession } from "./session/SessionContext";

/**
 * O papel exigido por cada rota de topo sai do registro de navegação (ADR-005), o mesmo
 * que a gaveta lê para montar sua lista — nenhum literal de papel sobra aqui.
 */
function roleForPath(path: string): UserRole {
  const item = NAV_ROUTES.find((route) => route.path === path);
  if (item === undefined) throw new Error(`Rota fora do registro de navegação: ${path}`);
  return item.role;
}

function QueueRoute() {
  const navigate = useNavigate();
  return <NotesQueueScreen onOpenNote={(noteId) => navigate(`/notas/${noteId}/bipagem`)} />;
}

function HistoryRoute() {
  const navigate = useNavigate();
  return <HistoryScreen onOpenReport={(noteId) => navigate(`/notas/${noteId}/relatorio`)} />;
}

function ChangePasswordRoute() {
  const navigate = useNavigate();
  // Trocada a senha, a trava cai e a "/" leva o usuário à tela inicial do seu papel.
  return <ChangePasswordScreen onChanged={() => navigate("/", { replace: true })} />;
}

export function App() {
  const { status, user } = useSession();
  if (status === "loading") return <Screen title="Conferência de notas">{null}</Screen>;
  if (user === null) return <LoginScreen />;

  // O admin passa por qualquer rota (ADR-006) e cai na gestão de usuários, sua tela
  // inicial natural; o gerente, no histórico.
  const home = getHomePathForRole(user.role);
  return (
    <RequirePasswordChange>
      <Routes>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route
          path="/notas"
          element={
            <RequireRole role={roleForPath("/notas")}>
              <QueueRoute />
            </RequireRole>
          }
        />
        <Route
          path="/notas/:noteId/bipagem"
          element={
            <RequireRole role={roleForPath("/notas")}>
              <ScanRoute />
            </RequireRole>
          }
        />
        <Route path="/notas/:noteId/relatorio" element={<ReportRoute />} />
        <Route
          path="/historico"
          element={
            <RequireRole role={roleForPath("/historico")}>
              <HistoryRoute />
            </RequireRole>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RequireRole role={roleForPath("/usuarios")}>
              <UsersScreen />
            </RequireRole>
          }
        />
        <Route path={CHANGE_PASSWORD_PATH} element={<ChangePasswordRoute />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </RequirePasswordChange>
  );
}
