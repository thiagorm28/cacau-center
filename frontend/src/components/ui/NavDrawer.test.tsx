import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../../api/types";
import { getNavItemsForRole } from "../../routes/navigation";
import { OPERADOR, withSession } from "../../test/session";
import { NavDrawer } from "./NavDrawer";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

// `getNavItemsForRole` é espionado (não substituído) só para o caso de contorno UT-022,
// em que o papel não alcança nenhuma funcionalidade.
vi.mock("../../routes/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../routes/navigation")>();
  return { ...actual, getNavItemsForRole: vi.fn(actual.getNavItemsForRole) };
});

const realNavigation =
  await vi.importActual<typeof import("../../routes/navigation")>("../../routes/navigation");

const ADMIN: SessionUser = {
  id: "admin-1",
  name: "Ana Souza",
  role: "admin",
  mustChangePassword: false,
};

interface Overrides {
  user?: SessionUser | null;
  status?: "loading" | "authenticated" | "anonymous";
  signOut?: () => Promise<void>;
}

const renderDrawer = (overrides: Overrides = {}, pathname = "/notas") =>
  render(
    withSession(
      <MemoryRouter initialEntries={[pathname]}>
        <NavDrawer />
      </MemoryRouter>,
      overrides,
    ),
  );

const trigger = () => screen.getByRole("button", { name: "Abrir menu de navegação" });
const backdrop = () => screen.getByRole("button", { name: "Fechar menu de navegação" });
const panel = () => screen.getByRole("dialog");
const navItems = () => within(screen.getByRole("navigation")).getAllByRole("button");

const openDrawer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(trigger());
  return panel();
};

const drag = (target: HTMLElement, distancePx: number) => {
  fireEvent.touchStart(target, { touches: [{ clientX: 200 }] });
  fireEvent.touchMove(target, { touches: [{ clientX: 200 + distancePx }] });
  fireEvent.touchEnd(target, { touches: [] });
};

beforeEach(() => {
  navigateMock.mockClear();
  vi.mocked(getNavItemsForRole).mockImplementation(realNavigation.getNavItemsForRole);
});

describe("NavDrawer — visibilidade", () => {
  it("UT-005: sessão ainda carregando não renderiza nada", () => {
    renderDrawer({ status: "loading" });

    expect(screen.queryByRole("button", { name: "Abrir menu de navegação" })).not.toBeInTheDocument();
  });

  it("UT-006: sessão anônima não renderiza nada", () => {
    renderDrawer({ user: null });

    expect(screen.queryByRole("button", { name: "Abrir menu de navegação" })).not.toBeInTheDocument();
  });

  it("UT-007: troca de senha obrigatória pendente não renderiza nada", () => {
    renderDrawer({ user: { ...OPERADOR, mustChangePassword: true } });

    expect(screen.queryByRole("button", { name: "Abrir menu de navegação" })).not.toBeInTheDocument();
  });

  it("UT-008: usuário autenticado vê o gatilho com nome acessível", () => {
    renderDrawer();

    expect(trigger()).toBeInTheDocument();
  });
});

describe("NavDrawer — abrir, fechar e gesto", () => {
  it("UT-009: tocar no gatilho abre o painel", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(trigger());

    expect(panel()).toBeInTheDocument();
  });

  it("UT-010: tocar no gatilho de novo com o painel aberto não duplica o painel", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(trigger());
    await user.click(trigger());

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("UT-011: tocar no fundo escurecido fecha o painel", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await openDrawer(user);

    await user.click(backdrop());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("UT-012: abrir e fechar repetidamente não acumula painel no DOM", async () => {
    const user = userEvent.setup();
    renderDrawer();

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await user.click(trigger());
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      await user.click(backdrop());
      expect(screen.queryAllByRole("dialog")).toHaveLength(0);
    }
  });

  it("UT-013: arrastar o painel para a esquerda além do limite fecha a gaveta", async () => {
    const user = userEvent.setup();
    renderDrawer();
    const sheet = await openDrawer(user);

    drag(sheet, -120);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("UT-014: arrastar sem alcançar o limite mantém a gaveta aberta e reencaixa o painel", async () => {
    const user = userEvent.setup();
    renderDrawer();
    const sheet = await openDrawer(user);

    drag(sheet, -20);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(panel()).toHaveStyle({ transform: "translateX(0px)" });
  });
});

describe("NavDrawer — foco", () => {
  it("UT-015: abrir move o foco para o primeiro elemento focável do painel", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await openDrawer(user);

    const [firstItem] = navItems();
    expect(firstItem).toBeDefined();
    expect(document.activeElement).toBe(firstItem);
  });

  it("UT-016: fechar pelo fundo devolve o foco ao gatilho", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await openDrawer(user);

    await user.click(backdrop());

    expect(document.activeElement).toBe(trigger());
  });

  it("Tab no último item focável (Sair) volta para o fundo, sem escapar do overlay", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await openDrawer(user);

    screen.getByRole("button", { name: "Sair" }).focus();
    await user.tab();

    expect(document.activeElement).toBe(backdrop());
  });

  it("Shift+Tab no primeiro item focável (fundo) vai para o último (Sair), sem escapar do overlay", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await openDrawer(user);

    backdrop().focus();
    await user.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sair" }));
  });
});

describe("NavDrawer — lista de navegação", () => {
  it("UT-017: operador vê apenas a fila de notas", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await openDrawer(user);

    expect(navItems().map((item) => item.textContent)).toEqual(["Fila de notas"]);
  });

  it("UT-018: admin vê as três funcionalidades na ordem do registro", async () => {
    const user = userEvent.setup();
    renderDrawer({ user: ADMIN });
    await openDrawer(user);

    expect(navItems().map((item) => item.textContent)).toEqual([
      "Fila de notas",
      "Histórico",
      "Gestão de usuários",
    ]);
  });

  it("UT-019: rota de sub-fluxo marca a funcionalidade de topo como ativa", async () => {
    const user = userEvent.setup();
    renderDrawer({}, "/notas/n1/bipagem");
    await openDrawer(user);

    const items = navItems();
    expect(items).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Fila de notas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("UT-020: tocar em item diferente do atual navega e fecha a gaveta", async () => {
    const user = userEvent.setup();
    renderDrawer({ user: ADMIN });
    await openDrawer(user);

    await user.click(screen.getByRole("button", { name: "Histórico" }));

    expect(navigateMock).toHaveBeenCalledWith("/historico");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("UT-021: tocar no item já ativo apenas fecha a gaveta", async () => {
    const user = userEvent.setup();
    renderDrawer({ user: ADMIN });
    await openDrawer(user);

    await user.click(screen.getByRole("button", { name: "Fila de notas" }));

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("UT-022: papel sem funcionalidades mantém identidade e sair, com a lista vazia", async () => {
    vi.mocked(getNavItemsForRole).mockReturnValue([]);
    const user = userEvent.setup();
    renderDrawer();
    await openDrawer(user);

    expect(within(screen.getByRole("navigation")).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(OPERADOR.name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });
});

describe("NavDrawer — identidade", () => {
  it("UT-023: mostra o nome e o papel por extenso, não o valor cru", async () => {
    const user = userEvent.setup();
    renderDrawer({ user: ADMIN });
    await openDrawer(user);

    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
  });

  it("UT-024: nome vazio cai num identificador não vazio", async () => {
    const user = userEvent.setup();
    renderDrawer({ user: { ...OPERADOR, name: "" } });
    const sheet = await openDrawer(user);

    expect(within(sheet).getByText("Usuário sem nome")).toBeInTheDocument();
  });

  it("UT-025: nome muito longo é truncado em vez de quebrar o painel", async () => {
    const longName = "A".repeat(80);
    const user = userEvent.setup();
    renderDrawer({ user: { ...OPERADOR, name: longName } });
    await openDrawer(user);

    expect(screen.getByText(longName)).toHaveClass("truncate");
  });
});

describe("NavDrawer — sair", () => {
  it("UT-026: tocar em sair chama o signOut da sessão uma vez", async () => {
    const signOut = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    renderDrawer({ signOut });
    await openDrawer(user);

    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("UT-027: dois toques rápidos em sair não disparam um segundo logout", async () => {
    // Promessa que não resolve: mantém o logout "em voo" entre os dois toques.
    const signOut = vi.fn(() => new Promise<void>(() => undefined));
    const user = userEvent.setup();
    renderDrawer({ signOut });
    await openDrawer(user);

    const exit = screen.getByRole("button", { name: "Sair" });
    await user.click(exit);
    await user.click(exit);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(exit).toBeDisabled();
  });
});
