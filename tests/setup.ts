import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import { deserialize, serialize } from "node:v8";
Object.defineProperty(globalThis, "crypto", { value: webcrypto });
Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
  structuredClone: (value: unknown) => deserialize(serialize(value)),
});
