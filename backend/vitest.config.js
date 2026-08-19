import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const resolvePath = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [
    // NestJS DI relies on `emitDecoratorMetadata`, which esbuild (Vitest's default
    // transformer) cannot emit — SWC is the only transformer that keeps the
    // `design:paramtypes` metadata the container and the ValidationPipe need.
    swc.vite({ module: { type: "es6" } }),
  ],
  resolve: {
    alias: {
      // Consume the `shared` workspace from source so the suite never depends on a
      // previous `npm run build` of that package.
      shared: resolvePath("../shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // The integration suite drives one real HTTP server against one real Postgres;
    // running files in parallel would make them fight over the same tables.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
