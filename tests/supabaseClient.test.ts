import { createClient } from "@supabase/supabase-js";
import { acquireSupabaseClient } from "../src/supabaseClient";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));

test("concurrent mounts and a refreshed module reuse one client; refresh follows owners, visibility and connectivity", async () => {
  const connection = {
    auth: {
      initialize: jest.fn(async () => ({ error: null })),
      startAutoRefresh: jest.fn(async () => {}),
      stopAutoRefresh: jest.fn(async () => {}),
    },
  };
  (createClient as jest.Mock).mockReturnValue(connection);
  const visible = jest
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  const online = jest.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const config = { url: "https://singleton-test.supabase.co", anonKey: "test" };
  // Background transitions run on a serialized promise chain.
  const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  const [first, second] = await Promise.all([
    acquireSupabaseClient(config),
    acquireSupabaseClient(config),
  ]);
  try {
    await settle();
    expect(first.client).toBe(second.client);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(connection.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    first.release();
    await settle();
    expect(connection.auth.stopAutoRefresh).toHaveBeenCalledTimes(1); // Only initialization has stopped it.
    visible.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(connection.auth.stopAutoRefresh).toHaveBeenCalledTimes(2);
    visible.mockReturnValue("visible");
    online.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(connection.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await settle();
    expect(connection.auth.startAutoRefresh).toHaveBeenCalledTimes(2);
    second.release();
    await settle();
    expect(connection.auth.stopAutoRefresh).toHaveBeenCalledTimes(3);
    let refreshed: typeof import("../src/supabaseClient") | undefined;
    await jest.isolateModulesAsync(async () => {
      refreshed = await import("../src/supabaseClient");
    });
    const remounted = await refreshed!.acquireSupabaseClient(config);
    await settle();
    expect(remounted.client).toBe(first.client);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(connection.auth.startAutoRefresh).toHaveBeenCalledTimes(3);
    remounted.release();
    await settle();
    expect(connection.auth.stopAutoRefresh).toHaveBeenCalledTimes(4);
    window.dispatchEvent(new Event("online"));
    await settle();
    expect(connection.auth.startAutoRefresh).toHaveBeenCalledTimes(3);
  } finally {
    first.release();
    second.release();
    await settle();
    visible.mockRestore();
    online.mockRestore();
  }
});
