import React from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import { App } from "./App";
import { IndexedRepository } from "./repository";
const client = new QueryClient({
  defaultOptions: {
    queries: { networkMode: "always", retry: false },
    mutations: { networkMode: "always", retry: false },
  },
});
const repository = new IndexedRepository();
const router = createHashRouter([
  { path: "*", element: <App repository={repository} /> },
]);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
