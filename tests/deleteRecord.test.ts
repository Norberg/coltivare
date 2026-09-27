import { deleteRecordChanges } from "../src/deleteRecord";
import { makeRecord, worldGeometry } from "../src/domain";

function fixture() {
  const workspace = makeRecord("workspace", crypto.randomUUID());
  workspace.workspaceId = workspace.id;
  const garden = makeRecord("garden", workspace.id, {
    name: "Trädgård",
    width: 20,
    height: 10,
  });
  const object = makeRecord("object", workspace.id, {
    name: "Land",
    gardenId: garden.id,
    geometry: {
      shape: "rectangle",
      x: 4,
      y: 2,
      width: 3,
      height: 2,
      rotation: 30,
    },
  });
  const plant = makeRecord("plant", workspace.id, { name: "Ros" });
  const planting = makeRecord("planting", workspace.id, {
    name: "Rosor",
    gardenId: garden.id,
    plantId: plant.id,
    snapshot: plant,
    count: 2,
  });
  const placement = makeRecord("placement", workspace.id, {
    name: "Rosor",
    gardenId: garden.id,
    plantingId: planting.id,
    objectId: object.id,
    layer: "actual",
    startDate: "2027-01-01",
    geometry: {
      shape: "rectangle",
      x: 0.5,
      y: 0.25,
      width: 1,
      height: 1,
      rotation: 0,
    },
  });
  for (const record of [object, plant, planting, placement]) record.revision = 1;
  return {
    object,
    plant,
    planting,
    placement,
    records: [workspace, garden, object, plant, planting, placement],
  };
}

test("deleting an object keeps bound plants at the same world position", () => {
  const { object, placement, records } = fixture();
  const before = worldGeometry(placement, records);
  const changes = deleteRecordChanges(object, records);
  expect(changes).toContainEqual({ before: object });
  const moved = changes.find((change) => change.before?.id === placement.id)!
    .after!;
  expect(moved.objectId).toBeUndefined();
  expect(moved.geometry).toEqual(before);
});

test("deleting a planting also deletes placements and deleting a used plant is rejected", () => {
  const { plant, planting, placement, records } = fixture();
  expect(
    deleteRecordChanges(planting, records).map((change) => change.before?.id),
  ).toEqual(expect.arrayContaining([planting.id, placement.id]));
  expect(() => deleteRecordChanges(plant, records)).toThrow(
    "Växten används i planteringen Rosor",
  );
});
