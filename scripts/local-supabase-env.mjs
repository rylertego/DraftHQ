import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const cliPath = path.join(
  repositoryRoot,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js"
);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

function assertLoopbackUrl(name, value) {
  if (!value) {
    throw new Error(`Supabase status did not return ${name}.`);
  }

  const parsedUrl = new URL(value);
  if (!loopbackHosts.has(parsedUrl.hostname)) {
    throw new Error(
      `Refusing to use non-local ${name} host: ${parsedUrl.hostname}`
    );
  }
}

export function getLocalSupabaseEnvironment() {
  const status = spawnSync(process.execPath, [cliPath, "status", "-o", "env"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  if (status.status !== 0) {
    const details = (status.stderr || status.stdout).trim();
    throw new Error(
      `Unable to read local Supabase status. Start it with npm run supabase:start.${
        details ? `\n${details}` : ""
      }`
    );
  }

  const environment = {};
  for (const line of status.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/);
    if (match) {
      environment[match[1]] = match[2] ?? match[3] ?? match[4].trim();
    }
  }

  assertLoopbackUrl("API_URL", environment.API_URL);
  assertLoopbackUrl("DB_URL", environment.DB_URL);

  if (!environment.ANON_KEY || !environment.SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase status did not return ANON_KEY and SERVICE_ROLE_KEY."
    );
  }

  return environment;
}
