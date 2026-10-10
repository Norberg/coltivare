import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { App } from "./App";
import type { Repository } from "./repository";
import { SupabaseRepository, supabaseGateway } from "./supabaseRepository";

const modeKey = "coltivare-storage-mode";
function rememberedMode() {
  try {
    return localStorage.getItem(modeKey) === "cloud";
  } catch {
    return false;
  }
}

export function WorkspaceApp({
  localRepository,
  config,
}: {
  localRepository: Repository;
  config: { url: string; anonKey: string };
}) {
  const [cloud, setCloud] = useState(rememberedMode);
  const [client, setClient] = useState<SupabaseClient>();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    setReady(false);
    void import("@supabase/supabase-js")
      .then(async ({ createClient }) => {
        if (!active) return;
        const connection = createClient(config.url, config.anonKey, {
          auth: { flowType: "pkce", storageKey: "coltivare-supabase-auth" },
        });
        const {
          data: { subscription },
        } = connection.auth.onAuthStateChange((_event, next) => {
          if (active) setSession(next);
        });
        cleanup = () => {
          subscription.unsubscribe();
          connection.auth.stopAutoRefresh();
        };
        setClient(connection);
        const { data, error: authError } = await connection.auth.getSession();
        if (!active) return;
        if (authError) setError(authError.message);
        setSession(data.session);
        setReady(true);
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
          setReady(true);
        }
      });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [cloud, config.url, config.anonKey]);

  const userId = session?.user.id;
  const repository = useMemo(
    () =>
      cloud && client && userId
        ? new SupabaseRepository(supabaseGateway(client))
        : localRepository,
    [cloud, client, userId, localRepository],
  );
  useEffect(
    () => () => {
      if (repository !== localRepository) void repository.close();
    },
    [repository, localRepository],
  );
  const cache = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { networkMode: "always", retry: false },
          mutations: { networkMode: "always", retry: false },
        },
      }),
    [repository],
  );
  useEffect(() => () => cache.clear(), [cache]);

  function switchMode(next: boolean) {
    if (
      !confirm(
        next
          ? "Byta till molnlagring? Lokala data finns kvar och förs inte över automatiskt. Spara pågående formulär och en lokal backup först."
          : "Byta till lokal lagring? Spara pågående formulär först. Molndata finns kvar på ditt konto.",
      )
    )
      return;
    try {
      localStorage.setItem(modeKey, next ? "cloud" : "local");
    } catch {
      /* This session still works without remembered mode. */
    }
    setSession(null);
    setClient(undefined);
    setError("");
    setReady(false);
    setCloud(next);
  }

  const controls = (
    <section className="cloud-controls" aria-label="Lagringsläge">
      <strong>{cloud ? "Molnlagring" : "Lokal lagring"}</strong>
      {cloud ? (
        <>
          {session && <span>{session.user.email}</span>}
          <button onClick={() => switchMode(false)}>
            Använd lokal lagring
          </button>
          {session && client && (
            <button
              onClick={async () => {
                const { error: signOutError } = await client.auth.signOut({
                  scope: "local",
                });
                if (signOutError) setError(signOutError.message);
              }}
            >
              Logga ut
            </button>
          )}
        </>
      ) : (
        <button onClick={() => switchMode(true)}>Använd Supabase</button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );

  return (
    <>
      {cloud && (!ready || !client || !session) && controls}
      {cloud && (!ready || !client) ? (
        <main className="page">
          <p>
            {error
              ? "Molnanslutningen kunde inte öppnas."
              : "Öppnar molnanslutningen…"}
          </p>
        </main>
      ) : cloud && !session && client ? (
        <CloudLogin client={client} />
      ) : (
        <QueryClientProvider client={cache}>
          <App
            key={cloud ? session?.user.id : "local"}
            repository={repository}
            storageMode={cloud ? "cloud" : "local"}
            storageControls={controls}
          />
        </QueryClientProvider>
      )}
    </>
  );
}

function CloudLogin({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="page cloud-login">
      <h1>{register ? "Skapa konto" : "Logga in till molnlagring"}</h1>
      <p>
        Varje konto har en egen arbetsyta i Supabase. Använd samma konto på dina
        andra enheter. Molnläget kräver nätanslutning.
      </p>
      <p>
        Din lokala arbetsyta finns kvar. För att flytta den, spara en full
        backup i lokalt läge och återställ filen under Lagring efter inloggning.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          try {
            if (register) {
              const { data, error } = await client.auth.signUp({
                email: email.trim(),
                password,
                options: {
                  emailRedirectTo:
                    window.location.origin + window.location.pathname,
                },
              });
              if (error) throw error;
              if (!data.session)
                setMessage(
                  "Kontrollera din e-post och bekräfta kontot. Logga sedan in här.",
                );
            } else {
              const { error } = await client.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
              if (error) throw error;
            }
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          E-post
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="field">
          Lösenord
          <input
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Vänta…" : register ? "Skapa konto" : "Logga in"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRegister(!register);
              setError("");
              setMessage("");
            }}
          >
            {register ? "Jag har redan ett konto" : "Skapa ett konto"}
          </button>
        </div>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
