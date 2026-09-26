import { performanceFixture } from "./fixtures";
import { gardenWarnings } from "../src/warnings";
import { validateRecords } from "../src/domain";
test("100 structures, 1000 plantings and 2000 journal events retain domain integrity", () => {
  const fixture = performanceFixture(),
    garden = fixture.records.find((r) => r.kind === "garden")!;
  const start = performance.now();
  validateRecords(fixture.records);
  const validated = performance.now();
  const warnings = gardenWarnings(fixture.records, garden.id, "2027-06-01");
  const checked = performance.now();
  expect(warnings).toEqual([]);
  console.info(
    `Domain fixture: validation ${(validated - start).toFixed(1)} ms; date/warning evaluation ${(checked - validated).toFixed(1)} ms; ${fixture.records.length} records. This is not browser rendering performance.`,
  );
});
