import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../src/App";
import { MemoryRepository } from "./memory-repository";
test("the app creates and reloads a garden through an injected adapter without IndexedDB", async () => {
  const repo = new MemoryRepository(),
    client = new QueryClient({
      defaultOptions: {
        queries: { networkMode: "always", retry: false },
        mutations: { networkMode: "always", retry: false },
      },
    });
  const router = createMemoryRouter([
    { path: "*", element: <App repository={repo} /> },
  ]);
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Skapa din första trädgård" }),
  );
  fireEvent.change(screen.getByLabelText("Namn"), {
    target: { value: "Injicerad trädgård" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Spara" }));
  expect(
    await screen.findByRole("heading", {
      name: "Injicerad trädgård",
      level: 1,
    }),
  ).toBeVisible();
  expect((await repo.list()).filter((r) => r.kind === "garden")).toHaveLength(
    1,
  );
  view.unmount();
  client.clear();
});
