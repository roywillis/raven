import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** `npm run check:sheets`: read-only check of the live Google Sheet. Reads `.env.local`; process env wins. */
const fileEnv = loadEnv("", process.cwd(), "");
const processEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/live/**/*.live.test.ts"],
    env: { ...fileEnv, ...processEnv },
    testTimeout: 60_000,
  },
});
