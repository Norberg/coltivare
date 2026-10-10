import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { App } from "./App";
import type { Repository } from "./repository";
import { SupabaseRepository, supabaseGateway } from "./supabaseRepository";
import { clearAuthReturn, isAuthReturn } from "./authRedirect";

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
  const navigate = useNavigate();
  const [cloud, setCloud] = useState(
    () => rememberedMode() || isAuthReturn(window.location.href),
  );
  const [client, setClient] = useState<SupabaseClient>();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cloud) return;
    const callback = isAuthReturn(window.location.href);
    if (callback) {
      try {
        localStorage.setItem(modeKey, "cloud");
      } catch {
        /* The link still works without remembering the mode. */
      }
    }
    let active = true;
    let cleanup: (() => void) | undefined;
    setReady(false);
    void import("@supabase/supabase-js")
      .then(async ({ createClient }) => {
        if (!active) return;
        const connection = createClient(config.url, config.anonKey, {
          auth: {
            // Standard email links use an implicit callback on this static, client-only site.
            // Still accept code callbacks from the previous PKCE sign-up flow.
            flowType: new URL(window.location.href).searchParams.has("code")
              ? "pkce"
              : "implicit",
            storageKey: "coltivare-supabase-auth",
            detectSessionInUrl: true,
          },
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
        const { error: initializationError } =
          await connection.auth.initialize();
        const { data, error: authError } = await connection.auth.getSession();
        if (!active) return;
        if (callback) {
          clearAuthReturn();
          navigate("/installningar", { replace: true });
        }
        if (initializationError || (callback && !data.session))
          setError(
            "Inloggningslänken kunde inte användas. Den kan ha gått ut eller redan vara använd. Begär en ny länk.",
          );
        else if (authError) setError(authError.message);
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
  }, [cloud, config.url, config.anonKey, navigate]);

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
        <CloudLogin client={client} onSent={() => setError("")} />
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

function CloudLogin({
  client,
  onSent,
}: {
  client: SupabaseClient;
  onSent: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="page cloud-login">
      <h1>Logga in till molnlagring</h1>
      <p>
        Ange din e-postadress så skickar vi en inloggningslänk. Öppna länken för
        att logga in. Ett konto skapas första gången. Använd samma e-postadress
        på dina andra enheter.
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
            const address = email.trim();
            const { error } = await client.auth.signInWithOtp({
              email: address,
              options: {
                shouldCreateUser: true,
                emailRedirectTo:
                  window.location.origin + window.location.pathname,
              },
            });
            if (error) throw error;
            onSent();
            setMessage(
              `En inloggningslänk har skickats till ${address}. Kontrollera din inkorg och skräppost. Öppna länken för att logga in.`,
            );
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
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? "Skickar…"
              : message
                ? "Skicka ny inloggningslänk"
                : "Skicka inloggningslänk"}
          </button>
        </div>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
