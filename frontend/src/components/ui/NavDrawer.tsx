import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, TouchEvent as ReactTouchEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { UserRole } from "../../api/types";
import { getNavItemsForRole } from "../../routes/navigation";
import { useSession } from "../../session/SessionContext";
import { PillButton } from "./PillButton";

/** Distância mínima do arrasto para a esquerda que fecha a gaveta (ADR-006). */
const SWIPE_CLOSE_THRESHOLD_PX = 60;

const ROLE_LABELS: Record<UserRole, string> = {
  operador: "Operador",
  gerente: "Gerente",
  admin: "Administrador",
};

/** Nome vazio não pode deixar a área de identidade em branco (US-004.EC-1). */
const NAME_FALLBACK = "Usuário sem nome";

const FOCUSABLE_SELECTOR = "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

/**
 * Arrastar para fechar sem biblioteca de gestos (ADR-006): guarda o X inicial, segue o
 * dedo apenas no sentido negativo e decide no `touchend` pela distância percorrida.
 *
 * O arrasto é ignorado quando começa sobre um elemento interativo (item de navegação,
 * sair) — lá o toque é um clique, não um gesto (risco levantado no TechSpec).
 */
function useSwipeToClose(active: boolean, onClose: () => void) {
  const startXRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);

  const reset = useCallback(() => {
    startXRef.current = null;
    offsetRef.current = 0;
    setDragOffsetPx(0);
  }, []);

  const onTouchStart = useCallback(
    (event: ReactTouchEvent) => {
      if (!active) return;
      const target = event.target;
      if (target instanceof Element && target.closest(FOCUSABLE_SELECTOR) !== null) return;
      const touch = event.touches[0];
      if (touch === undefined) return;
      startXRef.current = touch.clientX;
      offsetRef.current = 0;
      setDragOffsetPx(0);
    },
    [active],
  );

  const onTouchMove = useCallback((event: ReactTouchEvent) => {
    const startX = startXRef.current;
    if (startX === null) return;
    const touch = event.touches[0];
    if (touch === undefined) return;
    const offset = Math.min(0, touch.clientX - startX);
    offsetRef.current = offset;
    setDragOffsetPx(offset);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (startXRef.current === null) return;
    const offset = offsetRef.current;
    reset();
    if (offset <= -SWIPE_CLOSE_THRESHOLD_PX) onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  return { onTouchStart, onTouchMove, onTouchEnd, dragOffsetPx };
}

/**
 * Gaveta de navegação global: fica embutida no `Screen` (ADR-004) e decide sozinha se
 * aparece, lendo a sessão — nenhuma tela precisa passar prop nenhuma.
 *
 * Some na tela de login (anônimo) e na troca de senha obrigatória (ADR-001/US-006), onde
 * navegar para outra funcionalidade seria justamente escapar da trava.
 */
export function NavDrawer() {
  const { status, user, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);

  const close = useCallback(() => setIsOpen(false), []);
  const swipe = useSwipeToClose(isOpen, close);

  // Foco entra no painel ao abrir e volta para o gatilho em qualquer caminho de
  // fechamento (fundo, gesto ou navegação), senão ele se perderia no `<body>`.
  useEffect(() => {
    if (isOpen) {
      setIsEntered(true);
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      return;
    }
    setIsEntered(false);
    if (hasOpenedRef.current) triggerRef.current?.focus();
  }, [isOpen]);

  // Toda navegação fecha a gaveta, não só os três caminhos com gesto próprio
  // (fundo, swipe, item da lista) — inclui o botão/gesto de voltar do sistema
  // (US-002.EC-1), que muda a rota sem passar por nenhum desses handlers.
  useEffect(() => {
    close();
  }, [location.key, close]);

  if (status !== "authenticated" || user === null || user.mustChangePassword) return null;

  const items = getNavItemsForRole(user.role);
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const open = () => {
    hasOpenedRef.current = true;
    setIsOpen(true);
  };

  const select = (path: string) => {
    if (!isActive(path)) navigate(path);
    close();
  };

  const logout = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    void signOut();
  };

  // Prende o Tab dentro do overlay (fundo + painel) enquanto a gaveta está aberta,
  // senão o foco escaparia para a tela por baixo, que só está coberta visualmente
  // pelo fundo escurecido — não pelo teclado (Accessibility do PRD).
  const trapTabKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const overlay = overlayRef.current;
    if (overlay === null) return;
    const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const displayName = user.name.trim() === "" ? NAME_FALLBACK : user.name;
  const translateX = isEntered ? `${swipe.dragOffsetPx}px` : "-100%";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Abrir menu de navegação"
        aria-expanded={isOpen}
        onClick={open}
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-pill bg-choc-700 text-cream-1 transition-colors hover:bg-choc-600"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {!isOpen ? null : (
        <div ref={overlayRef} className="fixed inset-0 z-20" onKeyDown={trapTabKey}>
          <button
            type="button"
            aria-label="Fechar menu de navegação"
            onClick={close}
            className="absolute inset-0 h-full w-full bg-choc-800/60"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            onTouchStart={swipe.onTouchStart}
            onTouchMove={swipe.onTouchMove}
            onTouchEnd={swipe.onTouchEnd}
            style={{ transform: `translateX(${translateX})` }}
            className={`relative flex h-full w-[80%] max-w-xs flex-col rounded-r-sheet bg-surface px-6 pt-10 pb-8 shadow-lg ${
              // Durante o arrasto o painel segue o dedo; a transição só entra na
              // abertura e no encaixe de volta, senão o gesto ficaria atrasado.
              swipe.dragOffsetPx === 0 ? "transition-transform duration-200" : ""
            }`}
          >
            <div>
              <p className="truncate font-heading text-title text-choc-800">{displayName}</p>
              <p className="section-label mt-1 text-accent-700">{ROLE_LABELS[user.role]}</p>
            </div>
            <nav aria-label="Funcionalidades" className="mt-8 flex-1">
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      aria-current={isActive(item.path) ? "page" : undefined}
                      onClick={() => select(item.path)}
                      className={`w-full rounded-pill px-5 py-3 text-left font-body text-item font-semibold transition-colors ${
                        isActive(item.path)
                          ? "bg-accent-100 text-accent-700"
                          : "text-choc-700 hover:bg-accent-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-8 border-t border-accent-300 pt-6">
              <PillButton variant="secondary" fullWidth disabled={isSigningOut} onClick={logout}>
                Sair
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
