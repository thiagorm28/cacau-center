import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./PasswordField";

/** Casca controlada, como as telas usam o componente: o valor vive fora, a visibilidade não. */
function Harness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <PasswordField
      id="password"
      label="Senha"
      value={value}
      autoComplete="current-password"
      onChange={setValue}
    />
  );
}

const renderField = (initialValue = "") => {
  render(<Harness initialValue={initialValue} />);
  return {
    user: userEvent.setup(),
    input: screen.getByLabelText("Senha"),
    toggle: () => screen.getByRole("button", { name: /senha/ }),
  };
};

describe("PasswordField", () => {
  it("UT-014: renderiza oculto por padrão", () => {
    const { input } = renderField("chocolate1");

    expect(input).toHaveAttribute("type", "password");
  });

  it("UT-015: alternar mostra a senha em texto plano e alternar de novo volta a ocultar", async () => {
    const { user, input, toggle } = renderField("chocolate1");

    await user.click(toggle());
    expect(input).toHaveAttribute("type", "text");

    await user.click(toggle());
    expect(input).toHaveAttribute("type", "password");
  });

  it("UT-016: alternar não tira o foco do campo de senha", async () => {
    const { user, input, toggle } = renderField();

    await user.click(input);
    expect(input).toHaveFocus();

    await user.click(toggle());

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("type", "text");
  });

  it("UT-017: o rótulo acessível do botão descreve o estado atual", async () => {
    const { user } = renderField("chocolate1");

    const mostrar = screen.getByRole("button", { name: "Mostrar senha" });
    await user.click(mostrar);

    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar senha" })).not.toBeInTheDocument();
  });

  it("UT-018: campo vazio alterna normalmente", async () => {
    const { user, input, toggle } = renderField("");

    expect(input).toHaveValue("");
    await user.click(toggle());

    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("");
  });
});
