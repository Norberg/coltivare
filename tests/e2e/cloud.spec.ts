import { test, expect } from "@playwright/test";

test("production app opts into cloud, consumes an email link, reloads cloud data and returns to its untouched local garden", async ({
  page,
}) => {
  const cloud = { version: 0, records: [] as any[], histories: [] as any[] };
  const requests: string[] = [];
  let sentEmail: any;
  let redirectTo: string | null = null;
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
    if (path === "/auth/v1/otp") {
      sentEmail = request.postDataJSON();
      redirectTo = new URL(request.url()).searchParams.get("redirect_to");
    } else if (path === "/auth/v1/token")
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
  await expect(page.getByLabel("Lösenord")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Skicka inloggningslänk", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(user.email);
  expect(sentEmail).toMatchObject({ email: user.email, create_user: true });
  expect(redirectTo).toBe("http://127.0.0.1:4173/");
  expect(requests.some((url) => url.includes("/rest/v1/"))).toBe(false);
  // A link must also open cloud mode in a browser that has not remembered that choice.
  await page.evaluate(() => localStorage.removeItem("coltivare-storage-mode"));
  await page.goto("about:blank");
  await page.goto(
    `/#access_token=${token}&refresh_token=mock-refresh-token&expires_in=3600&token_type=bearer&type=magiclink`,
  );
  await expect(page.getByRole("button", { name: "Logga ut" })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:4173/#/installningar");
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

test("expired email link shows a retry and can return to local storage", async ({
  page,
}) => {
  await page.route("https://*.supabase.co/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(
    "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
  );
  await expect(
    page.getByRole("heading", { name: "Logga in till molnlagring" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Begär en ny länk");
  await expect(page).toHaveURL("http://127.0.0.1:4173/#/installningar");
  await expect(
    page.getByRole("button", { name: "Skicka inloggningslänk", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Använd lokal lagring" }).click();
  await expect(
    page.getByRole("button", { name: "Använd Supabase" }),
  ).toBeVisible();
});

test("failed email delivery request keeps the form available for retry", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("coltivare-storage-mode", "cloud"),
  );
  await page.route("https://*.supabase.co/**", async (route) => {
    expect(new URL(route.request().url()).pathname).toBe("/auth/v1/otp");
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "over_email_send_rate_limit",
        msg: "För många försök. Vänta och försök igen.",
      }),
    });
  });
  await page.goto("/");
  await page.getByLabel("E-post").fill("odlare@example.com");
  await page
    .getByRole("button", { name: "Skicka inloggningslänk", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("För många försök");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByLabel("E-post")).toHaveValue("odlare@example.com");
  await expect(
    page.getByRole("button", { name: "Skicka inloggningslänk", exact: true }),
  ).toBeEnabled();
});
