import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolvePath = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mesma convenção do backend e do frontend: o teste da raiz do pacote (IT-012)
      // consome `shared` a partir do fonte, para nunca depender de um `npm run build`
      // anterior.
      shared: resolvePath("./src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
