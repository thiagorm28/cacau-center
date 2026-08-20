import { describe, expect, it } from "vitest";
import { SessionRevocationStore } from "../../src/infra/auth/SessionRevocationStore";

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

describe("SessionRevocationStore", () => {
  it("UT-006 considera não revogado um usuário sem revogação registrada", () => {
    const store = new SessionRevocationStore();

    expect(store.isRevoked("u1", nowInSeconds())).toBe(false);
  });

  it("UT-007 revoga token emitido antes da revogação", () => {
    const store = new SessionRevocationStore();
    const iatBefore = nowInSeconds() - 60;

    store.revoke("u1");

    expect(store.isRevoked("u1", iatBefore)).toBe(true);
  });

  it("UT-008 aceita token emitido depois da revogação", () => {
    const store = new SessionRevocationStore();

    store.revoke("u1");
    const iatAfter = nowInSeconds() + 60;

    expect(store.isRevoked("u1", iatAfter)).toBe(false);
  });
});
