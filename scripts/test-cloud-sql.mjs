import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Requires Docker. The temporary PostgreSQL database contains test data only.
const name = `coltivare-sql-test-${randomUUID()}`;
function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(result.stderr || result.stdout);
  return result.stdout;
}
try {
  docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "-e",
    "POSTGRES_PASSWORD=temporary-test-only",
    "postgres:17-alpine",
  ]);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const result = spawnSync(
      "docker",
      ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
      { encoding: "utf8" },
    );
    if (result.status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw Error("Test PostgreSQL did not start");
  for (const file of [
    "tests/sql/bootstrap.sql",
    "supabase/migrations/202610100001_cloud_workspace.sql",
    "tests/sql/cloud-security.sql",
  ]) {
    console.log(
      docker(
        ["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
        { input: readFileSync(file, "utf8") },
      ),
    );
  }
  const contracts = spawnSync(
    process.execPath,
    ["scripts/local-tool.mjs", "jest", "--runInBand", "tests/contract.test.ts"],
    {
      stdio: "inherit",
      env: { ...process.env, COLTIVARE_SQL_TEST_CONTAINER: name },
    },
  );
  if (contracts.status !== 0)
    throw Error("PostgreSQL repository contracts failed");
} finally {
  spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
}
