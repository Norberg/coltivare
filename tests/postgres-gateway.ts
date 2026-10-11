import { spawnSync } from "node:child_process";
import { DomainError, type Snapshot } from "../src/domain";
import type { CloudGateway, CloudState } from "../src/supabaseRepository";

/** Executes the actual RPC SQL in the isolated Docker database, with per-test owners. */
export class PostgresGateway implements CloudGateway {
  private owner = crypto.randomUUID();
  constructor(private container: string) {
    this.query(`insert into auth.users(id) values ('${this.owner}');`, true);
  }
  private query(statement: string, admin = false) {
    const result = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        this.container,
        "psql",
        "-U",
        "postgres",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
      ],
      {
        input: admin
          ? statement
          : `set role authenticated; set request.jwt.claim.sub = '${this.owner}'; ${statement}`,
        encoding: "utf8",
      },
    );
    if (result.status !== 0) {
      throw new DomainError(
        result.stderr.includes("40001") ? "conflict" : "unavailable",
        result.stderr,
      );
    }
    return result.stdout.trim();
  }
  async read(): Promise<CloudState> {
    return JSON.parse(this.query("select public.coltivare_read_workspace();"));
  }
  async version() {
    return Number(
      this.query(
        "select coalesce((select version from public.coltivare_workspaces), 0);",
      ),
    );
  }
  async write(version: number, snapshot: Snapshot) {
    const sqlJson = (value: unknown) =>
      "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
    return Number(
      this.query(
        `select public.coltivare_save_workspace(${version}, ${sqlJson(snapshot.records)}, ${sqlJson(snapshot.histories || [])});`,
      ),
    );
  }
}
