import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Screen } from "./components/ui/Screen";
import { LoginScreen } from "./features/auth/LoginScreen";
import { HistoryScreen } from "./features/history/HistoryScreen";
import { NotesQueueScreen } from "./features/notes/NotesQueueScreen";
import { RequireRole } from "./routes/RequireRole";
import { ReportRoute } from "./routes/ReportRoute";
import { ScanRoute } from "./routes/ScanRoute";
import { useSession } from "./session/SessionContext";

function QueueRoute() {
  const navigate = useNavigate();
  return <NotesQueueScreen onOpenNote={(noteId) => navigate(`/notas/${noteId}/bipagem`)} />;
}

function HistoryRoute() {
  const navigate = useNavigate();
  return <HistoryScreen onOpenReport={(noteId) => navigate(`/notas/${noteId}/relatorio`)} />;
}

export function App() {
  const { status, user } = useSession();
  if (status === "loading") return <Screen title="Conferência de notas">{null}</Screen>;
  if (user === null) return <LoginScreen />;

  const home = user.role === "gerente" ? "/historico" : "/notas";
  return (
    <Routes>
      <Route path="/" element={<Navigate to={home} replace />} />
      <Route
        path="/notas"
        element={
          <RequireRole role="operador">
            <QueueRoute />
          </RequireRole>
        }
      />
      <Route
        path="/notas/:noteId/bipagem"
        element={
          <RequireRole role="operador">
            <ScanRoute />
          </RequireRole>
        }
      />
      <Route path="/notas/:noteId/relatorio" element={<ReportRoute />} />
      <Route
        path="/historico"
        element={
          <RequireRole role="gerente">
            <HistoryRoute />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
