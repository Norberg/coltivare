import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { createClient, type Session } from "@supabase/supabase-js";
import { WorkspaceApp } from "../src/WorkspaceApp";
import { MemoryRepository } from "./memory-repository";
import { TestCloudGateway } from "./cloud-gateway";
import { makeRecord } from "../src/domain";
import { SupabaseRepository } from "../src/supabaseRepository";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
const config = {
  url: "https://example.supabase.co",
  anonKey: "public-test-key",
};
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

test("local mode never starts Supabase; switching accounts/modes keeps their data and caches separate", async () => {
  const local = new MemoryRepository();
  const [workspace] = await local.list();
  await local.commit([
    {
      after: makeRecord("garden", workspace.id, {
        name: "Lokala trädgården",
        width: 10,
        height: 10,
      }),
    },
  ]);
  const server = new TestCloudGateway(),
    cloud = new SupabaseRepository(server);
  const remoteWorkspace = (await cloud.list()).find(
    (r) => r.kind === "workspace",
  )!;
  await cloud.commit([
    {
      after: makeRecord("garden", remoteWorkspace.id, {
        name: "Molnträdgården",
        width: 10,
        height: 10,
      }),
    },
  ]);
  let listener: (_event: string, session: Session | null) => void = () => {};
  const session = {
    user: { id: "cloud-user", email: "odlare@example.com" },
  } as Session;
  const connection = {
    auth: {
      onAuthStateChange: jest.fn((fn) => {
        listener = fn;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      initialize: jest.fn(async () => ({ error: null })),
      getSession: jest.fn(async () => ({
        data: { session: null },
        error: null,
      })),
      signInWithOtp: jest.fn(async () => ({ error: null })),
      signOut: jest.fn(async () => {
        listener("SIGNED_OUT", null);
        return { error: null };
      }),
      stopAutoRefresh: jest.fn(async () => {}),
      startAutoRefresh: jest.fn(async () => {}),
    },
    from: jest.fn(() => ({
      select: () => ({
        maybeSingle: async () => ({
          data: { version: server.state.version },
          error: null,
        }),
      }),
    })),
    rpc: jest.fn(async (name, args) => {
      if (name === "coltivare_read_workspace")
        return { data: await server.read(), error: null };
      await server.write(args.expected_version, {
        schemaVersion: 1,
        exportKind: "workspace",
        exportedAt: new Date().toISOString(),
        records: args.next_records,
        histories: args.next_histories,
      });
      return { data: server.state.version, error: null };
    }),
  };
  (createClient as jest.Mock).mockReturnValue(connection);
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: <WorkspaceApp localRepository={local} config={config} />,
      },
    ],
    { initialEntries: ["/installningar"] },
  );
  const view = render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  expect(
    await screen.findByRole("option", { name: "Lokala trädgården" }),
  ).toBeVisible();
  expect(createClient).not.toHaveBeenCalled();
  fireEvent.click(
    await screen.findByRole("button", { name: "Använd Supabase" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Logga in till molnlagring" }),
  ).toBeVisible();
  expect(connection.rpc).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("E-post"), {
    target: { value: "odlare@example.com" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Skicka inloggningslänk" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "odlare@example.com",
  );
  expect(connection.auth.signInWithOtp).toHaveBeenCalledWith({
    email: "odlare@example.com",
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin,
    },
  });
  expect(connection.rpc).not.toHaveBeenCalled();
  await act(async () => listener("SIGNED_IN", session));
  expect(
    await screen.findByRole("option", { name: "Molnträdgården" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("option", { name: "Lokala trädgården" }),
  ).not.toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Logga ut" }));
  });
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Logga in till molnlagring" }),
    ).toBeVisible(),
  );
  expect(
    screen.queryByRole("option", { name: "Molnträdgården" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Använd lokal lagring" }));
  expect(
    await screen.findByRole("option", { name: "Lokala trädgården" }),
  ).toBeVisible();
  expect(
    (await server.read()).records.some((r) => r.name === "Molnträdgården"),
  ).toBe(true);
  // Reopening cloud mode must reuse the Auth client and install one fresh subscriber.
  fireEvent.click(screen.getByRole("button", { name: "Använd Supabase" }));
  await screen.findByRole("heading", { name: "Logga in till molnlagring" });
  expect(createClient).toHaveBeenCalledTimes(1);
  view.unmount();
  await cloud.close();
});
