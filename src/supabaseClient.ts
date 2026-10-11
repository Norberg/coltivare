import type { SupabaseClient } from "@supabase/supabase-js";

type Config = { url: string; anonKey: string };
type Entry = {
  client: Promise<SupabaseClient>;
  owners: Set<symbol>;
  lifecycle: Promise<void>;
  refreshing: boolean;
  update: () => void;
};
// Keep the lazy client through Fast Refresh as well as React effect remounts.
const browser = globalThis as typeof globalThis & {
  __coltivareSupabaseClients?: Map<string, Entry>;
};
const clients = (browser.__coltivareSupabaseClients ??= new Map<
  string,
  Entry
>());

export async function acquireSupabaseClient(config: Config) {
  const key = config.url + "\n" + config.anonKey;
  let entry = clients.get(key);
  if (!entry) {
    const client = import("@supabase/supabase-js").then(
      async ({ createClient }) => {
        const connection = createClient(config.url, config.anonKey, {
          auth: {
            flowType: new URL(window.location.href).searchParams.has("code")
              ? "pkce"
              : "implicit",
            storageKey: "coltivare-supabase-auth",
            detectSessionInUrl: true,
          },
        });
        await connection.auth.initialize();
        // The owner/visibility controller below handles background refresh.
        await connection.auth.stopAutoRefresh();
        return connection;
      },
    );
    const created: Entry = {
      client,
      owners: new Set(),
      lifecycle: Promise.resolve(),
      refreshing: false,
      update: () => {},
    };
    created.update = () => {
      // Serialize start/stop so an old effect's cleanup cannot stop its replacement.
      created.lifecycle = created.lifecycle
        .then(async () => {
          const connection = await created.client;
          const refresh =
            created.owners.size > 0 &&
            document.visibilityState !== "hidden" &&
            navigator.onLine;
          if (refresh === created.refreshing) return;
          if (refresh) await connection.auth.startAutoRefresh();
          else await connection.auth.stopAutoRefresh();
          created.refreshing = refresh;
        })
        .catch(() => {
          /* Initialization errors are reported by the acquiring component. */
        });
    };
    entry = created;
    clients.set(key, entry);
  }
  const current = entry;
  const owner = Symbol("cloud owner");
  current.owners.add(owner);
  if (current.owners.size === 1) {
    window.addEventListener("online", current.update);
    window.addEventListener("offline", current.update);
    document.addEventListener("visibilitychange", current.update);
  }
  current.update();
  const release = () => {
    current.owners.delete(owner);
    if (!current.owners.size) {
      window.removeEventListener("online", current.update);
      window.removeEventListener("offline", current.update);
      document.removeEventListener("visibilitychange", current.update);
    }
    current.update();
  };
  try {
    return { client: await current.client, release };
  } catch (error) {
    release();
    throw error;
  }
}
