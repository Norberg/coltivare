import React from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import { WorkspaceApp } from "./WorkspaceApp";
import publicConfig from "./supabase-config.json";
import { IndexedRepository } from "./repository";
const config = {
  url: import.meta.env.VITE_SUPABASE_URL || publicConfig.url,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || publicConfig.anonKey,
};
const repository = new IndexedRepository();
const router = createHashRouter([
  {
    path: "*",
    element: <WorkspaceApp localRepository={repository} config={config} />,
  },
]);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
