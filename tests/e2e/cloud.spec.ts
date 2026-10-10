import { test, expect } from "@playwright/test";

test("production app opts into cloud, logs in, reloads cloud data and returns to its untouched local garden", async ({
  page,
}) => {
  const cloud = { version: 0, records: [] as any[], histories: [] as any[] };
  const requests: string[] = [];
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "odlare@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "mock-signature",
  ].join(".");
  await page.route("https://*.supabase.co/**", async (route) => {
    const request = route.request();
    requests.push(request.url());
    const path = new URL(request.url()).pathname;
    let body: unknown = {};
    let status = 200;
    if (path === "/auth/v1/token")
      body = {
        access_token: token,
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user,
      };
    else if (path === "/auth/v1/user") body = user;
    else if (path === "/rest/v1/rpc/coltivare_read_workspace") body = cloud;
    else if (path === "/rest/v1/rpc/coltivare_save_workspace") {
      const data = request.postDataJSON();
      if (data.expected_version !== cloud.version) {
        status = 409;
        body = { code: "40001", message: "conflict" };
      } else {
        cloud.version++;
        cloud.records = data.next_records;
        cloud.histories = data.next_histories;
        body = cloud.version;
      }
    } else if (path !== "/auth/v1/logout")
      throw Error(`Unexpected Supabase request: ${path}`);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Skapa din första trädgård" }).click();
  await page.getByLabel("Namn", { exact: true }).fill("Lokala trädgården");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lokala trädgården", level: 1 }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByRole("link", { name: "Lagring", exact: true }).click();
  await page.getByRole("button", { name: "Använd Supabase" }).click();
  await expect(
    page.getByRole("heading", { name: "Logga in till molnlagring" }),
  ).toBeVisible();
  await page.getByLabel("E-post").fill(user.email);
  await page.getByLabel("Lösenord").fill("test-only-password");
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  await page.getByRole("button", { name: "Skapa din första trädgård" }).click();
  await page.getByLabel("Namn", { exact: true }).fill("Molnträdgården");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Molnträdgården", level: 1 }),
  ).toBeVisible();
  expect(cloud.records.some((r) => r.name === "Molnträdgården")).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Molnträdgården", level: 1 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Lagring", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Molnlagring & säkerhetskopior" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(
    page.getByRole("heading", { name: "Logga in till molnlagring" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Använd lokal lagring" }).click();
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lokala trädgården", level: 1 }),
  ).toBeVisible();
  expect(cloud.records.some((r) => r.name === "Molnträdgården")).toBe(true);
});
