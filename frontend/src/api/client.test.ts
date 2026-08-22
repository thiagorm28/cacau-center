import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, deleteNote } from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deleteNote", () => {
  it("UT-045: envia DELETE para /notes/:id e resolve no 204 sem corpo", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteNote("note-1")).resolves.toBeUndefined();

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toContain("/notes/note-1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    // A sessão viaja no cookie httpOnly (ADR-009), como nas demais chamadas.
    expect(init.credentials).toBe("include");
  });

  it("UT-046: rejeita com ApiError quando a resposta não é 2xx", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Nota não está mais em conferência" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(deleteNote("note-1")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "Nota não está mais em conferência",
    });
    await expect(deleteNote("note-1")).rejects.toBeInstanceOf(ApiError);
  });
});
