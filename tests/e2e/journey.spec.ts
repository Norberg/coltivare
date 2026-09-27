import { test, expect, type Page } from "@playwright/test";
import { performanceFixture } from "../fixtures";
import { chromium } from "@playwright/test";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { browserArguments } from "../browser-options";
import type { Snapshot } from "../../src/domain";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-04-01T12:00:00Z"));
});
async function createGarden(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skapa din första trädgård" }).click();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Min trädgård", exact: true, level: 1 }),
  ).toBeVisible();
}
test("Only rectangles and ellipses can be created and selected in the form", async ({
  page,
}) => {
  await createGarden(page);
  await expect(
    page.getByRole("button", { name: "Polygon", exact: true }),
  ).toHaveCount(0);
  for (const tool of ["Rektangel", "Ellips"]) {
    await draw(page, tool);
    await expect(
      page.getByRole("button", { name: "Redigera hörn" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Redigera egenskaper", exact: true })
      .click();
    await expect(page.getByLabel("Form").locator("option")).toHaveText([
      "Rektangel",
      "Ellips / individ",
    ]);
    await page.getByRole("button", { name: "Spara", exact: true }).click();
  }
  await expect(page.locator(".structure-shape")).toHaveCount(2);
});
test("Names can be hidden per bed, placement or whole planting and persist", async ({
  page,
}) => {
  await createGarden(page);
  await namedBed(page, "Dold bädd");
  await expect(page.locator(".structure-shape text")).toHaveText("Dold bädd");
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Visa namn på trädgårdsvyn").uncheck();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".structure-shape text")).toHaveCount(0);
  await createPlant(page, "Lavendel");
  await plant(page, "Lavendel", false);
  await expect(page.locator(".plant-name")).toContainText("Lavendel");
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Visa namn på trädgårdsvyn").uncheck();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".plant-name")).toHaveCount(0);
  const snapshot = await exported(page);
  expect(
    snapshot.records.find((record) => record.name === "Dold bädd")?.showName,
  ).toBe(false);
  expect(
    snapshot.records.find((record) => record.kind === "placement")?.showName,
  ).toBe(false);
  await page.reload();
  await page.getByLabel("Kartdatum").fill("2027-04-15");
  await expect(page.locator(".structure-shape text, .plant-name")).toHaveCount(
    0,
  );
  await page.locator(".plant-shape").click();
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Visa namn på trädgårdsvyn").check();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".plant-name")).toContainText("Lavendel");
  await page.locator(".plant-shape").click();
  await page
    .getByRole("button", { name: "Redigera plantering och antal" })
    .click();
  await expect(page.getByLabel("Visa namn på trädgårdsvyn")).toBeChecked();
  await page.getByLabel("Visa namn på trädgårdsvyn").uncheck();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".plant-name")).toHaveCount(0);
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(page.locator(".plant-name")).toContainText("Lavendel");
});
async function draw(page: Page, tool: string, x = 200, y = 150) {
  await page.getByRole("button", { name: tool, exact: true }).click();
  await page
    .getByRole("application", { name: "Trädgårdskarta" })
    .click({ position: { x, y } });
}
test("New flower icons can be selected, mixed and restored", async ({
  page,
}, testInfo) => {
  await createGarden(page);
  const names = ["Lobelia", "Ringblomma", "Aubrietia", "Borstnejlika"];
  for (const name of names) await createPlant(page, name, name);
  await page.getByRole("button", { name: "Plantera", exact: true }).click();
  await page.getByLabel("Växt att plantera").selectOption("");
  await page.getByLabel("Blandad plantering", { exact: true }).check();
  await page.getByLabel("Blandningens namn").fill("Sommarblandning");
  for (const name of names)
    await page.getByRole("checkbox", { name, exact: true }).check();
  const box = await page.getByRole("application").boundingBox();
  await page.mouse.move(box!.x + 100, box!.y + 100);
  await page.mouse.down();
  await page.mouse.move(box!.x + 400, box!.y + 240);
  await page.mouse.up();
  await page.getByLabel("Visas från").fill("2027-04-01");
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.locator(".plant-name")).toContainText("Sommarblandning");
  for (const name of names)
    expect(
      await page.locator(`.mixture-icons svg[aria-label="${name}"]`).count(),
    ).toBeGreaterThan(1);
  const snapshot = await exported(page);
  const planting = snapshot.records.find((r) => r.kind === "planting")!;
  expect(
    [planting.snapshot!, ...planting.additionalPlants!].map((p) => p.icon),
  ).toEqual(["lobelia", "calendula", "blueFescue", "sweetWilliam"]);
  await page.reload();
  await expect(page.locator(".plant-name")).toContainText("Sommarblandning");
  for (const name of names)
    expect(
      await page.locator(`.mixture-icons svg[aria-label="${name}"]`).count(),
    ).toBeGreaterThan(1);
  await page.screenshot({
    path: testInfo.outputPath("new-flower-icons.png"),
    fullPage: true,
  });
});

test("A mix can be planted using only checked species, without a dropdown plant", async ({
  page,
}) => {
  await createGarden(page);
  await createPlant(page, "Blåklint");
  await createPlant(page, "Lavendel");
  await page.getByRole("button", { name: "Plantera", exact: true }).click();
  await page.getByLabel("Växt att plantera").selectOption("");
  await page.getByLabel("Blandad plantering", { exact: true }).check();
  await page.getByLabel("Blandningens namn").fill("Blomsteräng utan huvudväxt");
  await page.getByRole("checkbox", { name: "Blåklint", exact: true }).check();
  await page.getByRole("application").click({ position: { x: 200, y: 150 } });
  await page.getByLabel("Visas från").fill("2027-04-01");
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Välj minst två olika växter",
  );
  await expect(page.getByLabel("Osparad plantering")).toBeVisible();
  await page.getByRole("checkbox", { name: "Lavendel", exact: true }).check();
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.locator(".plant-name")).toContainText(
    "Blomsteräng utan huvudväxt",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  const snapshot = await exported(page);
  const planting = snapshot.records.find(
    (record) => record.kind === "planting",
  )!;
  expect(planting.snapshot?.name).toBe("Blåklint");
  expect(planting.additionalPlants?.map((plant) => plant.name)).toEqual([
    "Lavendel",
  ]);
  expect(
    snapshot.records.filter((record) => record.kind === "placement"),
  ).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".plant-name")).toContainText("Blåklint, Lavendel");
});

test("A meadow is one mixed planting with editable species, persistent snapshots and undo", async ({
  page,
}, testInfo) => {
  await createGarden(page);
  for (const name of ["Lavendel", "Blåklint", "Krokus"])
    await createPlant(page, name, name);
  await page.getByRole("button", { name: "Plantera", exact: true }).click();
  await page
    .getByLabel("Växt att plantera")
    .selectOption({ label: "Lavendel" });
  await page.getByLabel("Blandad plantering", { exact: true }).check();
  await page.getByLabel("Blandningens namn").fill("Blomsteräng");
  await page.getByLabel("Antal plantor").fill("100");
  const box = await page.getByRole("application").boundingBox();
  await page.mouse.move(box!.x + 150, box!.y + 150);
  await page.mouse.down();
  await page.mouse.move(box!.x + 350, box!.y + 260);
  await page.mouse.up();
  await page.getByLabel("Visas från").fill("2027-04-01");
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Välj minst två olika växter",
  );
  await expect(page.getByLabel("Osparad plantering")).toBeVisible();
  await page.getByRole("checkbox", { name: "Blåklint", exact: true }).check();
  await page.getByRole("checkbox", { name: "Krokus", exact: true }).check();
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.locator(".plant-shape")).toHaveCount(1);
  await expect(page.locator(".plant-name")).toContainText("Blomsteräng");
  await expect(page.locator(".plant-name")).toContainText(
    "Lavendel, Blåklint, Krokus",
  );
  await expect(page.locator(".warnings")).toHaveCount(0);
  const icons = page.locator(".mixture-icons .map-plant-icon");
  expect(await icons.count()).toBeGreaterThan(6);
  for (const name of ["Lavendel", "Blåklint", "Krokus"]) {
    expect(
      await page.locator(`.mixture-icons svg[aria-label="${name}"]`).count(),
    ).toBeGreaterThan(1);
  }
  const layout = await icons.evaluateAll((nodes) =>
    nodes.map((node) => ({
      x: Number(node.getAttribute("x")),
      y: Number(node.getAttribute("y")),
      size: Number(node.getAttribute("width")),
      icon: node.getAttribute("aria-label"),
    })),
  );
  expect(new Set(layout.map((item) => item.x)).size).toBeGreaterThan(3);
  expect(new Set(layout.map((item) => item.y)).size).toBeGreaterThan(3);
  layout.forEach((a, i) => {
    for (const b of layout.slice(i + 1))
      expect(
        a.x + a.size <= b.x ||
          b.x + b.size <= a.x ||
          a.y + a.size <= b.y ||
          b.y + b.size <= a.y,
      ).toBe(true);
  });
  const backup = await exported(page);
  const mixture = backup.records.find((r) => r.kind === "planting")!;
  expect(mixture.count).toBe(100);
  expect(mixture.additionalPlants?.map((p) => p.name).sort()).toEqual([
    "Blåklint",
    "Krokus",
  ]);
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(page.locator(".plant-shape")).toHaveCount(0);
  await page.getByRole("button", { name: "Gör om", exact: true }).click();
  await expect(page.locator(".plant-shape")).toHaveCount(1);
  await page.reload();
  await page.getByLabel("Kartdatum").fill("2027-04-01");
  await expect(page.locator(".plant-name")).toContainText("Blomsteräng");
  expect(
    await icons.evaluateAll((nodes) =>
      nodes.map((node) => ({
        x: Number(node.getAttribute("x")),
        y: Number(node.getAttribute("y")),
        size: Number(node.getAttribute("width")),
        icon: node.getAttribute("aria-label"),
      })),
    ),
  ).toEqual(layout);
  await page.locator(".plant-shape").click();
  await page.screenshot({
    path: testInfo.outputPath("mixed-meadow.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Redigera plantering och antal" })
    .click();
  await page.getByRole("checkbox", { name: "Krokus", exact: true }).uncheck();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".plant-name")).toContainText("Lavendel, Blåklint");
  await expect(page.locator(".plant-name")).not.toContainText("Krokus");
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(page.locator(".plant-name")).toContainText("Krokus");
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "Ny journalhändelse" }).click();
  await page
    .getByLabel("Händelsetyp", { exact: true })
    .last()
    .selectOption("Vattning");
  await page.getByLabel("Händelsedatum").fill("2027-04-01");
  await page
    .getByLabel("Gäller", { exact: true })
    .selectOption({ label: "Blomsteräng" });
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  for (const name of ["Lavendel", "Blåklint", "Krokus"]) {
    await page
      .getByRole("combobox", { name: "Växt", exact: true })
      .selectOption({ label: name });
    await expect(page.locator(".calendar")).toContainText(
      "Vattning · Blomsteräng",
    );
  }
});
async function exported(page: Page): Promise<Snapshot> {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Säkerhetskopiera allt", exact: true })
    .first()
    .click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8"));
}
async function namedBed(page: Page, name: string) {
  await draw(page, "Rektangel");
  await expect(page.locator(".right-panel h2")).toHaveText("Ny odlingsyta");
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Namn", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Spara", exact: true }).click();
}
async function createPlant(page: Page, name = "Morot, test A", icon?: string) {
  await page.getByRole("button", { name: "Skapa egen växt" }).click();
  await page.getByLabel("Namn", { exact: true }).fill(name);
  if (icon)
    await page
      .getByRole("button", { name: `Ikon: ${icon}`, exact: true })
      .click();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
}
async function plant(
  page: Page,
  name = "Morot, test A",
  unknown = false,
  options: {
    from?: string;
    last?: string;
    bound?: string;
    count?: string;
  } = {},
) {
  await page.getByRole("button", { name: "Plantera", exact: true }).click();
  await page.getByLabel("Växt att plantera").selectOption({ label: name });
  await page.getByLabel("Antal plantor").fill(options.count || "20");
  await page.getByRole("application").click({ position: { x: 200, y: 150 } });
  if (unknown)
    await page.getByLabel("Befintlig växt – startdatum okänt").check();
  else {
    await page.getByLabel("Visas från").fill(options.from || "2027-04-15");
    await page
      .getByLabel("Sista dagen på platsen")
      .fill(options.last || "2027-08-31");
  }
  if (options.bound)
    await page
      .getByLabel("Bunden till yta", { exact: true })
      .selectOption({ label: options.bound });
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
}
test("Multi-select moves a group atomically, excludes locked objects and undoes together", async ({
  page,
}, testInfo) => {
  await createGarden(page);
  for (const [name, x] of [
    ["A", "2"],
    ["B", "6"],
    ["C", "10"],
  ]) {
    await namedBed(page, name);
    await page
      .getByRole("button", { name: "Redigera egenskaper", exact: true })
      .click();
    await page.getByLabel("X (m)", { exact: true }).fill(x);
    await page.getByLabel("Y (m)", { exact: true }).fill("4");
    await page.getByLabel("Bredd (m)", { exact: true }).fill("2");
    await page.getByLabel("Höjd (m)", { exact: true }).fill("2");
    if (name === "C") await page.getByLabel("Lås objekt").check();
    await page.getByRole("button", { name: "Spara", exact: true }).click();
  }
  await page.getByLabel("Snäppning", { exact: true }).uncheck();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  await page.getByLabel("Snäpp mot odlingar", { exact: true }).uncheck();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  const before = (await exported(page)).records.filter(
    (r) => r.kind === "object",
  );
  await page.getByRole("button", { name: "Flytta", exact: true }).click();
  await page.getByLabel("Markera många", { exact: true }).check();
  const map = page.getByRole("application");
  const positions = await map.evaluate((node) => {
    const m = (node as SVGGraphicsElement).getScreenCTM()!;
    return [
      { x: 1, y: 3 },
      { x: 13, y: 7 },
    ].map((p) => ({ x: m.a * p.x + m.e, y: m.d * p.y + m.f }));
  });
  await page.mouse.move(positions[0].x, positions[0].y);
  await page.mouse.down();
  await page.mouse.move(positions[1].x, positions[1].y, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".structure-shape.selected")).toHaveCount(2);
  await expect(page.getByText("2 markerade", { exact: true })).toBeVisible();
  const a = page
    .locator(".structure-shape")
    .filter({ has: page.locator("title", { hasText: /^A$/ }) });
  const box = (await a.locator("rect").first().boundingBox())!;
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let writes = 0;
    IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
      if (this.name === "records" && ++writes === 2) {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Injected failure", "QuotaExceededError");
      }
      return key === undefined
        ? original.call(this, value)
        : original.call(this, value, key);
    };
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 30,
    box.y + box.height / 2 + 20,
    { steps: 6 },
  );
  await page.screenshot({ path: testInfo.outputPath("group-move.png") });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Försök spara gruppflytten igen" }),
  ).toBeVisible();
  expect(
    (await exported(page)).records.filter((r) => r.kind === "object"),
  ).toEqual(before);
  await page
    .getByRole("button", { name: "Försök spara gruppflytten igen" })
    .click();
  await expect(
    page.getByRole("button", { name: "Försök spara gruppflytten igen" }),
  ).toHaveCount(0);
  const after = (await exported(page)).records.filter(
    (r) => r.kind === "object",
  );
  const delta = (name: string) => {
    const old = before.find((r) => r.name === name)!.geometry!,
      next = after.find((r) => r.name === name)!.geometry!;
    return { x: next.x - old.x, y: next.y - old.y };
  };
  expect(delta("A").x).toBeGreaterThan(0);
  expect(delta("A").x).toBeCloseTo(delta("B").x, 10);
  expect(delta("A").y).toBeCloseTo(delta("B").y, 10);
  expect(delta("C")).toEqual({ x: 0, y: 0 });
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  expect(
    (await exported(page)).records
      .filter((r) => r.kind === "object")
      .map((r) => r.geometry),
  ).toEqual(before.map((r) => r.geometry));
  await page.getByRole("button", { name: "Gör om", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  await page.reload();
  expect(
    (await exported(page)).records
      .filter((r) => r.kind === "object")
      .map((r) => r.geometry),
  ).toEqual(after.map((r) => r.geometry));
});
test("Multi-select supports additive clicks, deselection and Escape during dragging", async ({
  page,
}) => {
  await createGarden(page);
  await namedBed(page, "A");
  await draw(page, "Rektangel", 330, 220);
  const before = (await exported(page)).records.filter(
    (r) => r.kind === "object",
  );
  await page.getByRole("button", { name: "Flytta", exact: true }).click();
  await page.getByLabel("Markera många", { exact: true }).check();
  const objects = page.locator(".structure-shape");
  await objects.nth(0).click();
  await objects.nth(1).click();
  await expect(page.locator(".structure-shape.selected")).toHaveCount(2);
  await objects.nth(0).click();
  await expect(page.locator(".structure-shape.selected")).toHaveCount(1);
  await objects.nth(0).click();
  await expect(page.locator(".structure-shape.selected")).toHaveCount(2);
  const b = (await objects.nth(0).locator("rect").first().boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 20, {
    steps: 4,
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(
    (await exported(page)).records.filter((r) => r.kind === "object"),
  ).toEqual(before);
});
test("Move snaps 3.3 metre squares edge to edge independently of the grid", async ({
  page,
}, testInfo) => {
  await createGarden(page);
  for (const [name, x] of [
    ["A", "1,23"],
    ["B", "8"],
  ]) {
    await namedBed(page, name);
    await page
      .getByRole("button", { name: "Redigera egenskaper", exact: true })
      .click();
    await page.getByLabel("X (m)", { exact: true }).fill(x);
    await page.getByLabel("Y (m)", { exact: true }).fill("2,07");
    await page.getByLabel("Bredd (m)", { exact: true }).fill("3,3");
    await page.getByLabel("Höjd (m)", { exact: true }).fill("3,3");
    await page.getByRole("button", { name: "Spara", exact: true }).click();
  }
  await page.getByRole("button", { name: "Flytta", exact: true }).click();
  const object = page
    .locator(".structure-shape")
    .filter({ has: page.locator("title", { hasText: /^B$/ }) });
  const b = (await object.locator("rect").first().boundingBox())!;
  const scale = await page
    .getByRole("application")
    .evaluate((node) => (node as SVGGraphicsElement).getScreenCTM()!.a);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    b.x + b.width / 2 + (4.57 - 8) * scale,
    b.y + b.height / 2 + 0.04 * scale,
    { steps: 10 },
  );
  await expect(page.locator(".snap-guides line")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("edge-snapping.png") });
  await page.mouse.up();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  let saved = (await exported(page)).records.find((r) => r.name === "B")!;
  expect(saved.geometry!.x).toBeCloseTo(4.53, 10);
  expect(saved.geometry!.y).toBeCloseTo(2.07, 10);
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  saved = (await exported(page)).records.find((r) => r.name === "B")!;
  expect(saved.geometry!.x).toBe(8);
  await page.getByRole("button", { name: "Gör om", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  await page.getByLabel("Snäpp mot odlingar", { exact: true }).uncheck();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  await page.reload();
  await expect(
    page.getByLabel("Snäpp mot odlingar", { exact: true }),
  ).not.toBeChecked();
  await expect(page.getByLabel("Snäppning", { exact: true })).toBeChecked();
  saved = (await exported(page)).records.find((r) => r.name === "B")!;
  expect(saved.geometry!.x).toBeCloseTo(4.53, 10);
});
test("Changing toolbar modes clears the selected object and inspector", async ({
  page,
}) => {
  await createGarden(page);
  await draw(page, "Rektangel");
  const object = page.locator(".structure-shape");
  await expect(object).toHaveClass(/selected/);
  for (const mode of [
    "Flytta",
    "Panorera",
    "Rektangel",
    "Ellips",
    "Gång",
    "Plantera",
  ]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(object).not.toHaveClass(/selected/);
    await expect(page.locator(".right-panel h2")).toHaveCount(0);
    await page.getByRole("button", { name: "Välj", exact: true }).click();
    await expect(object).not.toHaveClass(/selected/);
    await object.click();
    await expect(object).toHaveClass(/selected/);
  }
  await page.getByRole("button", { name: "Flytta", exact: true }).click();
  await object.click();
  await expect(object).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Välj", exact: true }).click();
  await expect(object).not.toHaveClass(/selected/);
});
test("A single plant defaults to a rectangle and can still be changed to an ellipse", async ({
  page,
}) => {
  await createGarden(page);
  await createPlant(page);
  await page.getByRole("button", { name: "Plantera", exact: true }).click();
  await expect(page.getByLabel("Antal plantor")).toHaveValue("1");
  await page.getByRole("application").click({ position: { x: 200, y: 150 } });
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.locator(".plant-shape > rect")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".plant-shape > rect")).toHaveCount(1);
  await page.locator(".plant-shape").click();
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await expect(page.getByLabel("Form", { exact: true })).toHaveValue(
    "rectangle",
  );
  await page.getByLabel("Form", { exact: true }).selectOption("ellipse");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".plant-shape > ellipse")).toHaveCount(1);
});
test("Plants and names stay above beds; a path can be drawn across a bed", async ({
  page,
}, testInfo) => {
  await createGarden(page);
  await createPlant(page, "Lavendel");
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ikon: Lavendel", exact: true })
    .click();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await plant(page, "Lavendel", true);
  await draw(page, "Rektangel");
  const before = (await exported(page)).records.find(
    (r) => r.kind === "object",
  )!;
  await page.getByRole("button", { name: "Gång", exact: true }).click();
  await page.getByLabel("Gångbredd (m)", { exact: true }).fill("0,6");
  await page.getByLabel("Gångbredd (m)", { exact: true }).blur();
  const b = (await page.getByRole("application").boundingBox())!;
  await page.mouse.move(b.x + 180, b.y + 130);
  await page.mouse.down();
  await page.mouse.move(b.x + 280, b.y + 190, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".right-panel h2")).toHaveText("Ny gång");
  const after = await exported(page);
  expect(after.records.find((r) => r.id === before.id)?.geometry).toEqual(
    before.geometry,
  );
  expect(
    after.records.find((r) => r.category === "Gång")?.geometry,
  ).toMatchObject({ shape: "rectangle", height: 0.6 });
  const layers = page.locator("svg[role=application] > g[data-layer]");
  expect(
    await layers.evaluateAll((elements) =>
      elements.map((e) => e.getAttribute("data-layer")),
    ),
  ).toEqual(["0", "1", "2"]);
  await expect(page.locator(".plant-name")).toHaveText("Lavendel");
  await expect(page.locator(".plant-name")).toBeVisible();
  await expect(page.locator(".map-plant-icon")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("path-and-plant-label.png"),
  });
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(page.locator('g[data-layer="1"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Gör om", exact: true }).click();
  await expect(page.locator('g[data-layer="1"]')).toHaveCount(1);
  await page.reload();
  expect(
    await layers.evaluateAll((elements) =>
      elements.map((e) => e.getAttribute("data-layer")),
    ),
  ).toEqual(["0", "1", "2"]);
  await expect(page.locator(".plant-name")).toHaveText("Lavendel");
});
test("Select never moves objects; Move drags, saves and supports undo", async ({
  page,
}) => {
  await createGarden(page);
  await draw(page, "Rektangel");
  const object = page.locator(".structure-shape");
  const before = await object.getAttribute("transform");
  const drag = async () => {
    const b = (await object.locator("rect").first().boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 20, {
      steps: 5,
    });
    await page.mouse.up();
  };
  await page.getByRole("button", { name: "Välj", exact: true }).click();
  await drag();
  await expect(object).toHaveAttribute("transform", before!);
  await expect(page.locator(".right-panel h2")).toHaveText("Ny odlingsyta");
  await page.getByRole("button", { name: "Flytta", exact: true }).click();
  await drag();
  await expect(object).not.toHaveAttribute("transform", before!);
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(object).toHaveAttribute("transform", before!);
});
test("Figure colors and plant icons persist with snapshots and portable export", async ({
  page,
}, testInfo) => {
  await createGarden(page);
  await draw(page, "Rektangel");
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Figurfärg", { exact: true }).fill("#e9ad65");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".structure-shape > rect").first()).toHaveAttribute(
    "fill",
    "#e9ad65",
  );
  await page.getByRole("button", { name: "Skapa egen växt" }).click();
  await page.getByLabel("Namn", { exact: true }).fill("Lavendel");
  await expect(page.getByRole("button", { name: /^Ikon: / })).toHaveCount(23);
  await page
    .getByRole("button", { name: "Ikon: Lavendel", exact: true })
    .click();
  await page.getByLabel("Figurfärg", { exact: true }).fill("#bdb0e0");
  await page
    .getByRole("group", { name: "Växtikon", exact: true })
    .screenshot({ path: testInfo.outputPath("plant-icons.png") });
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await plant(page, "Lavendel", true);
  await expect(page.locator(".plant-shape > rect").first()).toHaveAttribute(
    "fill",
    "#bdb0e0",
  );
  await expect(page.locator(".map-plant-icon")).toHaveAttribute(
    "aria-label",
    "Lavendel",
  );
  await page.reload();
  await expect(page.locator(".map-plant-icon")).toHaveAttribute(
    "aria-label",
    "Lavendel",
  );
  await page
    .locator(".object-list button")
    .filter({ hasText: "Växtregister" })
    .click();
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByRole("button", { name: "Ikon: Ros", exact: true }).click();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".map-plant-icon")).toHaveAttribute(
    "aria-label",
    "Lavendel",
  );
  await page.locator(".plant-shape > rect").first().click();
  await page
    .getByRole("button", { name: "Redigera plantering och antal" })
    .click();
  await page.getByRole("button", { name: "Ikon: Tulpan", exact: true }).click();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".map-plant-icon")).toHaveAttribute(
    "aria-label",
    "Tulpan",
  );
  const snapshot = await exported(page);
  expect(snapshot.records.find((r) => r.kind === "object")?.color).toBe(
    "#e9ad65",
  );
  expect(snapshot.records.find((r) => r.kind === "planting")).toMatchObject({
    icon: "tulip",
    snapshot: { icon: "lavender", color: "#bdb0e0" },
  });
  await page.getByRole("link", { name: "Lagring", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportera trädgård", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles((await (await download).path())!);
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  await expect(page.locator(".map-plant-icon")).toHaveAttribute(
    "aria-label",
    "Tulpan",
  );
  await expect(page.locator(".structure-shape > rect").first()).toHaveAttribute(
    "fill",
    "#e9ad65",
  );
});
test("Resize handles save dimensions, undo, redo and cancel with Escape", async ({
  page,
}, testInfo) => {
  await createGarden(page);
  await draw(page, "Rektangel");
  const shape = page.locator(".structure-shape > rect").first();
  const before = await shape.getAttribute("width");
  await page
    .getByRole("button", { name: "Ändra storlek", exact: true })
    .click();
  await page.screenshot({ path: testInfo.outputPath("resize-handles.png") });
  const handle = page.getByRole("button", {
    name: "Ändra storlek se",
    exact: true,
  });
  const drag = async (cancel = false) => {
    const b = (await handle.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 45, b.y + b.height / 2 + 25, {
      steps: 5,
    });
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
  };
  await drag();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  await expect(shape).not.toHaveAttribute("width", before!);
  const after = await shape.getAttribute("width");
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(shape).toHaveAttribute("width", before!);
  await page.getByRole("button", { name: "Gör om", exact: true }).click();
  await expect(shape).toHaveAttribute("width", after!);
  await drag(true);
  await expect(shape).toHaveAttribute("width", after!);
  await page.reload();
  await expect(shape).toHaveAttribute("width", after!);
});
test("AT-01–03: real IndexedDB garden, bed, planting and inclusive date boundaries", async ({
  page,
}) => {
  await createGarden(page);
  await draw(page, "Rektangel");
  await expect(page.locator("svg .structure-shape")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("svg .structure-shape")).toHaveCount(1);
  await createPlant(page);
  await plant(page);
  for (const [date, count] of [
    ["2027-04-14", 0],
    ["2027-04-15", 1],
    ["2027-08-31", 1],
    ["2027-09-01", 0],
  ] as const) {
    await page.getByLabel("Kartdatum").fill(date);
    await expect(page.locator("svg .plant-shape")).toHaveCount(count);
  }
});
test("Dragging a planting keeps its preview until saved, including with an open editor", async ({
  page,
}) => {
  await createGarden(page);
  await createPlant(page);
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByRole("button", { name: "Plantera", exact: true }).click();
  await expect(page.getByLabel("Växt att plantera")).not.toHaveValue("");
  await page.getByLabel("Antal plantor").fill("20");
  const box = (await page.getByRole("application").boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 180, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel("Osparad plantering")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Registrera placering" }),
  ).toBeFocused();
  await expect(page.locator("svg .plant-shape")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Spara plantering", exact: true })
    .click();
  await expect(page.locator("svg .plant-shape")).toHaveCount(1);
  await expect(page.getByLabel("Osparad plantering")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("svg .plant-shape")).toHaveCount(1);
});
test("Planting without a chosen plant explains what is missing and keeps the area until cancelled", async ({
  page,
}) => {
  await createGarden(page);
  await draw(page, "Plantera");
  await expect(page.getByLabel("Osparad plantering")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Välj en växt under Plantera",
  );
  await page.getByRole("button", { name: "Avbryt", exact: true }).click();
  await expect(page.getByLabel("Osparad plantering")).toHaveCount(0);
  await expect(page.locator("svg .plant-shape")).toHaveCount(0);
});
test("AT-05,07,08: perennial, journal calendar and multiple harvests", async ({
  page,
}) => {
  await createGarden(page);
  await createPlant(page, "Vinbär");
  await plant(page, "Vinbär", true);
  for (const date of ["2026-12-31", "2027-01-01"]) {
    await page.getByLabel("Kartdatum").fill(date);
    await expect(page.locator("svg .plant-shape")).toHaveCount(1);
  }
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  for (const [kind, date] of [
    ["Vattning", "2027-04-15"],
    ["Gödsling", "2027-04-19"],
    ["Skörd", "2027-04-20"],
    ["Skörd", "2027-04-21"],
  ]) {
    await page.getByRole("button", { name: "Ny journalhändelse" }).click();
    await page
      .getByLabel("Händelsetyp", { exact: true })
      .last()
      .selectOption(kind);
    await page.getByLabel("Händelsedatum").fill(date);
    await page
      .getByLabel("Gäller", { exact: true })
      .selectOption({ label: "Vinbär" });
    await page.getByRole("button", { name: "Spara", exact: true }).click();
  }
  await page.getByLabel("Månad", { exact: true }).fill("2027-04");
  await expect(page.locator(".calendar button")).toHaveCount(4);
  await expect(page.locator(".journal-row")).toHaveCount(4);
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  await page.getByLabel("Kartdatum").fill("2027-12-31");
  await expect(page.locator("svg .plant-shape")).toHaveCount(1);
});
test("AT-19,20: loaded app edits and exports offline without external requests", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await createGarden(page);
  await context.setOffline(true);
  await createPlant(page);
  await plant(page);
  await page.getByLabel("Kartdatum").fill("2027-04-15");
  await expect(page.locator("svg .plant-shape")).toHaveCount(1);
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Säkerhetskopiera allt", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain("backup");
  expect(
    requests.every(
      (r) =>
        r.startsWith("http://127.0.0.1:4173") ||
        r.startsWith("ws://127.0.0.1:4173"),
    ),
  ).toBe(true);
  await context.setOffline(false);
  await page.reload();
  await page.getByLabel("Kartdatum").fill("2027-04-15");
  await expect(page.locator("svg .plant-shape")).toHaveCount(1);
});
test("AT-12: two tabs preserve losing edits on a revision conflict", async ({
  page,
  context,
}) => {
  await createGarden(page);
  const second = await context.newPage();
  await second.goto("/");
  await page.getByRole("button", { name: "Trädgårdens egenskaper" }).click();
  await second.getByRole("button", { name: "Trädgårdens egenskaper" }).click();
  await page.getByLabel("Namn", { exact: true }).fill("Första fliken");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await second.getByLabel("Namn", { exact: true }).fill("Andra fliken");
  await second.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(second.getByRole("alert").last()).toContainText("annan flik");
  await expect(second.getByLabel("Namn", { exact: true })).toHaveValue(
    "Andra fliken",
  );
});
test("AT-11: exported garden imports through file picker with new identity", async ({
  page,
}) => {
  await createGarden(page);
  await draw(page, "Rektangel");
  await createPlant(page, "Oanvänd växt");
  await page.getByRole("link", { name: "Lagring", exact: true }).click();
  const d = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportera trädgård", exact: true })
    .click();
  const path = await (await d).path();
  await page
    .getByLabel(
      "Importera trädgård som kopia / återställ arbetsytebackup (JSON, högst 20 MB)",
    )
    .setInputFiles(path!);
  await expect(page.getByLabel("Välj trädgård").locator("option")).toHaveCount(
    3,
  );
});
test("390px mobile supports map, date and journal", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createGarden(page);
  await page.getByLabel("Kartdatum").fill("2027-06-01");
  await page.screenshot({
    path: testInfo.outputPath("mobile-map.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "Ny journalhändelse" }).click();
  await page.getByLabel("Anteckningar").fill("<script>alert(1)</script>");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator(".journal-row")).toContainText(
    "<script>alert(1)</script>",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile-journal.png"),
    fullPage: true,
  });
});
test("Unsaved forms survive refused links and browser back; Escape cancels map drawing", async ({
  page,
}) => {
  await createGarden(page);
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "Ny journalhändelse" }).click();
  await page.getByLabel("Anteckningar").fill("Behåll mitt utkast");
  let dialogs = 0;
  let leave = false;
  page.on("dialog", async (dialog) => {
    if (leave) await dialog.accept();
    else await dialog.dismiss();
    dialogs++;
  });
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  await expect.poll(() => dialogs).toBe(1);
  await expect(page.getByLabel("Anteckningar")).toHaveValue(
    "Behåll mitt utkast",
  );
  await page.goBack();
  await expect.poll(() => dialogs).toBe(2);
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.getByLabel("Anteckningar")).toHaveValue(
    "Behåll mitt utkast",
  );
  leave = true;
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  await expect(page.getByRole("application")).toBeVisible();
  await page.getByRole("button", { name: "Rektangel", exact: true }).click();
  const drawingBox = await page.getByRole("application").boundingBox();
  await page.mouse.move(drawingBox!.x + 200, drawingBox!.y + 150);
  await page.mouse.down();
  await page.mouse.move(drawingBox!.x + 300, drawingBox!.y + 250);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("svg .structure-shape")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("svg .structure-shape")).toHaveCount(0);
});
test("AT-06: indoor sowing and explicitly combined transplant are separate", async ({
  page,
}) => {
  await createGarden(page);
  await createPlant(page);
  await page
    .getByRole("button", { name: "Ny odlingsomgång utan placering" })
    .click();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrera journalhändelse" })
    .click();
  await page.getByLabel("Händelsetyp", { exact: true }).selectOption("Sådd");
  await page.getByLabel("Händelsedatum").fill("2027-03-01");
  await page.getByLabel("Anteckningar").fill("Sådd inomhus");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await page.getByLabel("Kartdatum").fill("2027-04-01");
  await expect(page.locator("svg .plant-shape")).toHaveCount(0);
  await page
    .locator(".object-list button")
    .filter({ hasText: "1 planta/plantor" })
    .click();
  await page
    .getByRole("button", { name: "Registrera journalhändelse" })
    .click();
  await page
    .getByLabel("Händelsetyp", { exact: true })
    .selectOption("Utplantering");
  await page.getByLabel("Händelsedatum").fill("2027-05-20");
  await page.getByLabel("Skapa samtidigt en faktisk placering").check();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await page.getByLabel("Kartdatum").fill("2027-04-01");
  await expect(page.locator("svg .plant-shape")).toHaveCount(0);
  await page.getByLabel("Kartdatum").fill("2027-05-20");
  await expect(page.locator("svg .plant-shape")).toHaveCount(1);
});
test("AT-09,15: physical move keeps previous coordinates until its date", async ({
  page,
}) => {
  await createGarden(page);
  await createPlant(page);
  await plant(page);
  await page.getByLabel("Kartdatum").fill("2027-05-31");
  const old = await page.locator("svg .plant-shape").getAttribute("transform");
  await page.locator("svg .plant-shape").click();
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Registrera fysisk flytt", { exact: true }).check();
  await page.getByLabel("Flyttdatum").fill("2027-06-01");
  await page.getByLabel("X (m)", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.locator("svg .plant-shape")).toHaveAttribute(
    "transform",
    old!,
  );
  await page.getByLabel("Kartdatum").fill("2027-06-01");
  await expect(page.locator("svg .plant-shape")).toHaveCount(1);
  await expect(page.locator("svg .plant-shape")).not.toHaveAttribute(
    "transform",
    old!,
  );
});
test("AT-01,10: persistent isolated profile survives a full browser restart with undo", async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe("chromium");
  await mkdir(testInfo.outputDir, { recursive: true });
  const profile = await mkdtemp(path.join(testInfo.outputDir, "profile-"));
  let context = await chromium.launchPersistentContext(profile, {
    args: browserArguments,
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
  let page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await page.getByRole("button", { name: "Skapa din första trädgård" }).click();
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await draw(page, "Rektangel");
  await expect(page.locator("svg .structure-shape")).toHaveCount(1);
  await context.close();
  context = await chromium.launchPersistentContext(profile, {
    args: browserArguments,
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
  page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await expect(page.locator("svg .structure-shape")).toHaveCount(1);
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(page.locator("svg .structure-shape")).toHaveCount(0);
  await page.getByRole("button", { name: "Gör om", exact: true }).click();
  await expect(page.locator("svg .structure-shape")).toHaveCount(1);
  await context.close();
});
test("AT-22,25: workspace backup restores in an isolated empty browser context", async ({
  page,
  browser,
}) => {
  await createGarden(page);
  await createPlant(page, "Oanvänd");
  await page.getByRole("button", { name: "Ny trädgård", exact: true }).click();
  await page.getByLabel("Namn", { exact: true }).fill("Andra trädgården");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await page.getByLabel("Rutnät", { exact: true }).uncheck();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Säkerhetskopiera allt", exact: true })
    .click();
  const file = await (await downloading).path();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("http://127.0.0.1:4173/");
  await expect(
    other.getByRole("button", { name: "Skapa din första trädgård" }),
  ).toBeVisible();
  await other.getByRole("link", { name: "Lagring", exact: true }).click();
  await other.locator("input[type=file]").setInputFiles(file!);
  await other.getByRole("link", { name: "Kartan", exact: true }).click();
  await expect(
    other.getByRole("heading", {
      name: "Andra trädgården",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(other.locator(".object-list")).toContainText("Oanvänd");
  expect((await exported(other)).records).toEqual(
    JSON.parse(await readFile(file!, "utf8")).records,
  );
  await expect(other.getByLabel("Rutnät", { exact: true })).not.toBeChecked();
  await context.close();
});
test("PERF-01: measured UI load with explicit synthetic 100/1000/2000 fixture", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Lagring", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "performance.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(performanceFixture())),
  });
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  const start = Date.now();
  await page.getByRole("link", { name: "Kartan", exact: true }).click();
  await page.reload();
  await expect(page.locator("svg .plant-shape")).toHaveCount(1000);
  const loaded = Date.now() - start;
  await page.evaluate(() => {
    (window as any).paintSamples = [];
    document.addEventListener(
      "pointermove",
      (event) => {
        if (!(event.target as Element).closest("svg[role=application]")) return;
        const start = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            (window as any).paintSamples.push(performance.now() - start),
          ),
        );
      },
      true,
    );
  });
  const dateStart = Date.now();
  await page.getByLabel("Kartdatum").fill("2027-06-01");
  await expect(page.locator("svg .plant-shape")).toHaveCount(1000);
  const changed = Date.now() - dateStart;
  const panStart = Date.now();
  await page.getByRole("button", { name: "Panorera", exact: true }).click();
  const map = page.getByRole("application"),
    box = await map.boundingBox();
  await page.mouse.move(box!.x + 50, box!.y + 50);
  await page.mouse.down();
  await page.mouse.move(box!.x + 80, box!.y + 70);
  await page.mouse.up();
  const panned = Date.now() - panStart;
  await page
    .getByRole("button", { name: "Hela trädgården", exact: true })
    .click();
  await page.getByRole("button", { name: "Flytta", exact: true }).click();
  // Use the painted shape, not the group bounds (which also include its label).
  const target = page
      .locator(".plant-shape")
      .first()
      .locator("ellipse, rect")
      .first(),
    targetBox = await target.boundingBox();
  const dragStart = Date.now();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2 + 8,
    targetBox!.y + targetBox!.height / 2 + 8,
    { steps: 3 },
  );
  await page.mouse.up();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
  const dragged = Date.now() - dragStart;
  const paintSamples: number[] = await page.evaluate(
    () => (window as any).paintSamples,
  );
  await testInfo.attach("measured-performance.json", {
    body: JSON.stringify({
      viewport: "1280x800",
      loadMilliseconds: loaded,
      dateChangeMilliseconds: changed,
      panMilliseconds: panned,
      dragMilliseconds: dragged,
      pointerToTwoFramesMilliseconds: paintSamples,
      structures: 100,
      plantings: 1000,
      events: 2000,
    }),
    contentType: "application/json",
  });
  await page.screenshot({
    path: testInfo.outputPath("map.png"),
    fullPage: true,
  });
  await testInfo.attach("metrics.txt", {
    body: `load=${loaded}ms date=${changed}ms pan=${panned}ms`,
    contentType: "text/plain",
  });
  console.info(
    `Browser performance: first map ${loaded} ms; date ${changed} ms; pan ${panned} ms; drag ${dragged} ms; pointer-to-paint samples ${paintSamples.map((v) => v.toFixed(1)).join(", ")} ms`,
  );
  expect(loaded).toBeLessThan(3000);
});

test("AT-04: sequential crops reuse the same bed without temporal overlap", async ({
  page,
}) => {
  await createGarden(page);
  await namedBed(page, "Bädd A");
  await createPlant(page, "Grupp A");
  await plant(page, "Grupp A", false, {
    from: "2027-03-01",
    last: "2027-05-31",
    bound: "Bädd A",
  });
  await createPlant(page, "Grupp B");
  await plant(page, "Grupp B", false, {
    from: "2027-06-01",
    last: "2027-09-30",
    bound: "Bädd A",
  });
  await page.getByLabel("Kartdatum").fill("2027-05-31");
  await expect(page.locator(".plant-shape")).toHaveCount(1);
  await expect(page.locator(".plant-shape")).toContainText("Grupp A");
  await page.getByLabel("Kartdatum").fill("2027-06-01");
  await expect(page.locator(".plant-shape")).toHaveCount(1);
  await expect(page.locator(".plant-shape")).toContainText("Grupp B");
  await expect(page.locator(".warnings")).toHaveCount(0);
});
test("AT-10: numeric geometry, bound rotation, zoom and persistent undo", async ({
  page,
}) => {
  await createGarden(page);
  await namedBed(page, "Bädd A");
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Höjd (m)", { exact: true }).fill("1,2");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await createPlant(page);
  await plant(page, "Morot, test A", false, { bound: "Bädd A" });
  const before = await exported(page),
    position = before.records.find((r) => r.kind === "placement")!.geometry;
  await page
    .locator(".object-list button")
    .filter({ hasText: "Bädd A" })
    .click();
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Rotation (°)").fill("45");
  await page.getByLabel("X (m)", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  const after = await exported(page);
  expect(after.records.find((r) => r.kind === "placement")!.geometry).toEqual(
    position,
  );
  await expect(page.locator(".plant-shape")).toHaveAttribute(
    "transform",
    /rotate\(45\)/,
  );
  await page.getByRole("button", { name: "Zooma in" }).click();
  expect(
    (await exported(page)).records.find((r) => r.kind === "placement")!
      .geometry,
  ).toEqual(position);
  await page.reload();
  await page.getByLabel("Kartdatum").fill("2027-04-15");
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(page.locator(".plant-shape")).toHaveAttribute(
    "transform",
    /rotate\(0\)/,
  );
  await page.getByRole("button", { name: "Gör om", exact: true }).click();
  await expect(page.locator(".plant-shape")).toHaveAttribute(
    "transform",
    /rotate\(45\)/,
  );
});
test("AT-16–18: catalogue snapshots, reversible archive and overlap warning", async ({
  page,
}) => {
  await createGarden(page);
  await namedBed(page, "Bädd A");
  await createPlant(page);
  await plant(page, "Morot, test A", false, { bound: "Bädd A" });
  await page
    .locator(".object-list button")
    .filter({ hasText: "Växtregister" })
    .click();
  await page
    .getByRole("button", { name: "Redigera egenskaper", exact: true })
    .click();
  await page.getByLabel("Namn", { exact: true }).fill("Nytt sortnamn");
  await page.getByLabel("Skörd min (dagar)").fill("45");
  await page.getByLabel("Skörd räknas från").fill("Sådd");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  const snapshot = await exported(page);
  expect(
    snapshot.records.find((r) => r.kind === "planting")?.snapshot?.name,
  ).toBe("Morot, test A");
  expect(
    snapshot.records.find((r) => r.kind === "planting")?.snapshot?.fields?.[
      "Skörd min (dagar)"
    ],
  ).toBeUndefined();
  await page.getByRole("button", { name: "Arkivera", exact: true }).click();
  await expect(page.locator(".plant-shape")).toHaveCount(1);
  await page.getByLabel("Visa arkiverade").check();
  await page.getByRole("button", { name: "Återställ", exact: true }).click();
  await page.getByLabel("Visa arkiverade").uncheck();
  await page
    .locator(".object-list button")
    .filter({ hasText: "Bädd A" })
    .click();
  await page.getByRole("button", { name: "Arkivera", exact: true }).click();
  await expect(page.locator(".structure-shape")).toHaveCount(0);
  await expect(page.locator(".plant-shape")).toHaveCount(1);
  await page.getByLabel("Visa arkiverade").check();
  await page.getByRole("button", { name: "Återställ", exact: true }).click();
  await page.getByLabel("Visa arkiverade").uncheck();
  await plant(page, "Nytt sortnamn", false, { bound: "Bädd A" });
  await expect(page.locator(".plant-shape")).toHaveCount(2);
  await page.locator(".warnings summary").click();
  await expect(page.locator(".warnings")).toContainText(
    "överlappar i tid och rum",
  );
});
test("AT-12: injected quota and aborted real IDB transactions retain form values and roll back", async ({
  page,
}) => {
  await createGarden(page);
  const before = await exported(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let calls = 0;
    IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
      if (++calls === 2)
        throw new DOMException("Injected full disk", "QuotaExceededError");
      return key === undefined
        ? original.call(this, value)
        : original.call(this, value, key);
    };
    (window as any).restorePut = () => {
      IDBObjectStore.prototype.put = original;
    };
  });
  await page.getByRole("button", { name: "Ny trädgård", exact: true }).click();
  await page.getByLabel("Namn", { exact: true }).fill("Osparad trädgård");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.getByRole("alert").last()).toContainText(
    "Lagringsutrymmet",
  );
  await expect(page.getByLabel("Namn", { exact: true })).toHaveValue(
    "Osparad trädgård",
  );
  expect((await exported(page)).records).toEqual(before.records);
  await page.evaluate(() => {
    (window as any).restorePut();
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
      const request =
        key === undefined
          ? original.call(this, value)
          : original.call(this, value, key);
      this.transaction.abort();
      return request;
    };
    (window as any).restorePut = () => {
      IDBObjectStore.prototype.put = original;
    };
  });
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Kunde inte spara");
  expect((await exported(page)).records).toEqual(before.records);
  await page.evaluate(() => (window as any).restorePut());
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Sparat lokalt");
});
test("AT-13,20: production CSP, local-only traffic and invalid import leave data intact", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.addInitScript(() => {
    (window as any).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      (window as any).cspViolations.push(event.violatedDirective),
    );
  });
  await createGarden(page);
  await createPlant(page, '<script>alert("test")</script>');
  const before = await exported(page);
  await page.getByRole("link", { name: "Lagring", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...before,
        schemaVersion: 999,
        execute: 'fetch("https://example.com")',
      }),
    ),
  });
  await expect(page.getByRole("alert")).toContainText("formatversion");
  expect((await exported(page)).records).toEqual(before.records);
  expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
  expect(
    requests.every((url) => url.startsWith("http://127.0.0.1:4173/")),
  ).toBe(true);
});
for (const outcome of ["granted", "denied", "missing"] as const)
  test(`AT-23: persistent storage ${outcome}`, async ({ page }) => {
    await page.addInitScript((value) => {
      if (value === "missing") {
        Object.defineProperty(navigator, "storage", { value: undefined });
        return;
      }
      Object.defineProperty(navigator.storage, "persist", {
        value: async () => value === "granted",
      });
      Object.defineProperty(navigator.storage, "persisted", {
        value: async () => false,
      });
    }, outcome);
    await page.goto("/");
    await page.getByRole("link", { name: "Lagring", exact: true }).click();
    await page.getByRole("button", { name: "Begär beständig lagring" }).click();
    await expect(page.getByRole("status").last()).toContainText(
      outcome === "granted"
        ? "beviljades"
        : outcome === "denied"
          ? "nekades"
          : "saknar stöd",
    );
  });
async function previousSchema(page: Page, version = 1, keepOpen = false) {
  await page.route("**/schema-fixture.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Isolerad migrationsfixture</title>",
    }),
  );
  await page.goto("/schema-fixture.html");
  return page.evaluate(
    async ({ version, keepOpen }) => {
      const request = indexedDB.open("odlingskartan", version);
      request.onupgradeneeded = () => {
        const s = request.result.createObjectStore("records", {
          keyPath: "id",
        });
        s.createIndex("kind", "kind");
        s.createIndex("gardenId", "gardenId");
        s.createIndex("workspaceId", "workspaceId");
      };
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const workspaceId = crypto.randomUUID(),
        gardenId = crypto.randomUUID(),
        now = new Date().toISOString();
      const common = {
        workspaceId,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        archived: false,
        notes: "",
      };
      const records = [
        {
          ...common,
          id: workspaceId,
          kind: "workspace",
          name: "Äldre arbetsyta",
          lastGardenId: gardenId,
        },
        {
          ...common,
          id: gardenId,
          kind: "garden",
          name: "Bevarad trädgård",
          width: 20,
          height: 15,
        },
        {
          ...common,
          id: crypto.randomUUID(),
          kind: "object",
          gardenId,
          name: "Bevarad bädd",
          geometry: {
            x: 2,
            y: 3,
            width: 4,
            height: 1.2,
            rotation: 15,
            shape: "rectangle",
          },
        },
      ];
      const tx = db.transaction("records", "readwrite");
      for (const r of records) tx.objectStore("records").add(r);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      if (keepOpen) (window as any).fixtureDatabase = db;
      else db.close();
      return records;
    },
    { version, keepOpen },
  );
}
test("AT-21: real browser schema migration preserves identity and geometry", async ({
  page,
}) => {
  const records = await previousSchema(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Bevarad trädgård" }),
  ).toBeVisible();
  expect((await exported(page)).records).toEqual(
    expect.arrayContaining(records),
  );
  await expect(page.locator(".structure-shape")).toHaveAttribute(
    "transform",
    "translate(2 3) rotate(15)",
  );
});
test("AT-21: failed browser migration rolls back and newer schema is not deleted", async ({
  page,
  browser,
}) => {
  const records = await previousSchema(page);
  await page.addInitScript(() => {
    const create = IDBDatabase.prototype.createObjectStore;
    IDBDatabase.prototype.createObjectStore = function (name, options) {
      const store = create.call(this, name, options);
      if (name === "history") store.transaction.abort();
      return store;
    };
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("otillgänglig");
  const retained = await page.evaluate(async () => {
    const q = indexedDB.open("odlingskartan");
    const db = await new Promise<IDBDatabase>((resolve) => {
      q.onsuccess = () => resolve(q.result);
    });
    const get = db.transaction("records").objectStore("records").getAll();
    const rows = await new Promise((resolve) => {
      get.onsuccess = () => resolve(get.result);
    });
    const result = { version: db.version, rows };
    db.close();
    return result;
  });
  expect(retained.version).toBe(1);
  expect(retained.rows).toEqual(expect.arrayContaining(records));
  const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4173",
    }),
    other = await context.newPage();
  await previousSchema(other, 99);
  await other.goto("/");
  await expect(other.getByRole("alert")).toContainText("nyare appversion");
  await context.close();
});
test("AT-21: blocking old tab gives recovery instructions and versionchange closes current tabs", async ({
  page,
  context,
}) => {
  await previousSchema(page, 1, true);
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByRole("alert")).toContainText("äldre flik");
  await page.evaluate(() => (window as any).fixtureDatabase.close());
  await second.reload();
  await expect(
    second.getByRole("heading", { level: 1, name: "Bevarad trädgård" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const q = indexedDB.open("odlingskartan", 3);
    await new Promise<void>((resolve, reject) => {
      q.onsuccess = () => {
        q.result.close();
        resolve();
      };
      q.onerror = () => reject(q.error);
    });
  });
  await expect(second.getByRole("alert")).toContainText(
    "annan flik uppgraderar",
  );
});
test("AT-25: different origins are separate and backup transfer leaves the source intact", async ({
  page,
  context,
}) => {
  await createGarden(page);
  const source = await exported(page);
  const other = await context.newPage();
  await other.goto("http://localhost:4173/");
  await expect(
    other.getByRole("button", { name: "Skapa din första trädgård" }),
  ).toBeVisible();
  await other.getByRole("link", { name: "Lagring", exact: true }).click();
  await other.locator("input[type=file]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(source)),
  });
  await expect(other.getByRole("status").first()).toHaveText("Sparat lokalt");
  expect((await exported(other)).records).toEqual(source.records);
  expect((await exported(page)).records).toEqual(source.records);
});
test("AT-14: calendar dates and leap-day boundaries survive browser timezone changes", async ({
  page,
  browser,
}) => {
  await createGarden(page);
  await createPlant(page);
  await plant(page, "Morot, test A", false, {
    from: "2028-02-29",
    last: "2028-03-26",
  });
  const snapshot = await exported(page);
  for (const timezoneId of [
    "America/Los_Angeles",
    "Pacific/Auckland",
    "Europe/Stockholm",
  ]) {
    const context = await browser.newContext({ timezoneId });
    const other = await context.newPage();
    await other.goto("http://127.0.0.1:4173/");
    await other.getByRole("link", { name: "Lagring", exact: true }).click();
    await other.locator("input[type=file]").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(snapshot)),
    });
    await expect(other.getByRole("status").first()).toHaveText("Sparat lokalt");
    await other.getByRole("link", { name: "Kartan", exact: true }).click();
    for (const [date, count] of [
      ["2028-02-28", 0],
      ["2028-02-29", 1],
      ["2028-03-26", 1],
      ["2028-03-27", 0],
    ] as const) {
      await other.getByLabel("Kartdatum").fill(date);
      await expect(other.locator(".plant-shape")).toHaveCount(count);
    }
    expect((await exported(other)).records).toEqual(snapshot.records);
    await context.close();
  }
});
