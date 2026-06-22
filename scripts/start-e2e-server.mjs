import { spawn } from "node:child_process";
import process from "node:process";
import { getLocalSupabaseEnvironment } from "./local-supabase-env.mjs";

const environment = getLocalSupabaseEnvironment();
const npmCliPath = process.env.npm_execpath;

if (!npmCliPath) {
  throw new Error("npm_execpath is required to start the E2E web server.");
}

const server = spawn(
  process.execPath,
  [npmCliPath, "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: environment.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.ANON_KEY,
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
      SUPABASE_SECRET_KEY: environment.SERVICE_ROLE_KEY,
      NEXT_DISABLE_DEV_INDICATORS: "1",
      NEXT_DIST_DIR: ".next-e2e",
    },
    stdio: "inherit",
  }
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
