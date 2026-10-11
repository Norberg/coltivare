import { DomainError, type Snapshot } from "../src/domain";
import type { CloudGateway, CloudState } from "../src/supabaseRepository";

/** Shared server with compare-and-swap, independent of client workspace operations. */
export class TestCloudGateway implements CloudGateway {
  state: CloudState = { version: 0, records: [], histories: [] };
  failWrite = false;
  loseResponse = false;
  async version() {
    return this.state.version;
  }
  async read() {
    return structuredClone(this.state);
  }
  async write(expected: number, snapshot: Snapshot) {
    if (this.failWrite)
      throw new DomainError("unavailable", "Ingen anslutning");
    if (expected !== this.state.version)
      throw new DomainError("conflict", "Samtidig ändring");
    this.state = structuredClone({
      version: expected + 1,
      records: snapshot.records,
      histories: snapshot.histories || [],
    });
    if (this.loseResponse)
      throw new DomainError("unavailable", "Svar förlorat");
    return this.state.version;
  }
}
