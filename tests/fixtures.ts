import { makeRecord, type RecordData } from "../src/domain";
export function performanceFixture() {
  const id = crypto.randomUUID(),
    workspace = makeRecord("workspace", id, {
      id,
      name: "Prestandaprov",
      revision: 1,
    });
  const garden = makeRecord("garden", id, {
    name: "Prestandaträdgård",
    width: 100,
    height: 100,
    revision: 1,
  });
  const plant = makeRecord("plant", id, {
    name: "Exempelväxt – inga odlingsråd",
    revision: 1,
  });
  const records: RecordData[] = [workspace, garden, plant];
  for (let i = 0; i < 100; i++)
    records.push(
      makeRecord("object", id, {
        gardenId: garden.id,
        name: `Yta ${i + 1}`,
        revision: 1,
        geometry: {
          x: (i % 10) * 10,
          y: Math.floor(i / 10) * 10,
          width: 9,
          height: 9,
          rotation: 0,
          shape: "rectangle",
        },
      }),
    );
  for (let i = 0; i < 1000; i++) {
    const planting = makeRecord("planting", id, {
      gardenId: garden.id,
      plantId: plant.id,
      snapshot: plant,
      name: `Exempel ${i + 1}`,
      count: 1,
      revision: 1,
    });
    records.push(planting);
    records.push(
      makeRecord("placement", id, {
        gardenId: garden.id,
        plantingId: planting.id,
        name: planting.name,
        revision: 1,
        layer: "actual",
        startDate: "2027-01-01",
        geometry: {
          x: (i % 40) * 2,
          y: Math.floor(i / 40) * 2,
          width: 0.5,
          height: 0.5,
          rotation: 0,
          shape: "ellipse",
        },
      }),
    );
    for (const date of ["2027-03-01", "2027-03-02"])
      records.push(
        makeRecord("event", id, {
          gardenId: garden.id,
          targetId: planting.id,
          eventType: "Anteckning",
          date,
          notes: "Uttrycklig prestandafixture",
          revision: 1,
        }),
      );
  }
  return {
    schemaVersion: 1 as const,
    exportKind: "workspace" as const,
    exportedAt: new Date().toISOString(),
    records,
  };
}
