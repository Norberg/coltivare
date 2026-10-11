import { act, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GardenMap } from "../src/Map";
import { makeRecord } from "../src/domain";

test("grid hover shows only plant names and map labels obey cell space", () => {
  const workspace = makeRecord("workspace", crypto.randomUUID());
  workspace.workspaceId = workspace.id;
  const garden = makeRecord("garden", workspace.id, {
    name: "Trädgård",
    width: 20,
    height: 10,
  });
  const tomato = makeRecord("plant", workspace.id, {
    name: "Tomat",
    icon: "tomato",
  });
  const longName = makeRecord("plant", workspace.id, {
    name: "En mycket lång växtbeteckning",
  });
  const grid = makeRecord("plantGrid", workspace.id, {
    name: "Mitt rutnät",
    gardenId: garden.id,
    geometry: {
      x: 1,
      y: 1,
      width: 2,
      height: 1,
      rotation: 0,
      shape: "rectangle",
    },
    columns: 2,
    rows: 1,
    cellPlantIds: [tomato.id, longName.id],
  });
  const view = render(
    <GardenMap
      garden={garden}
      records={[workspace, garden, tomato, longName, grid]}
      date="2027-04-01"
      tool="select"
      grid
      snap={false}
      edgeSnap={false}
      structure
      plants
      onSelect={() => true}
      onCreate={() => undefined}
      onMove={async () => undefined}
      onMoveMany={async () => true}
      onCancel={() => undefined}
    />,
  );
  expect(
    Array.from(view.container.querySelectorAll(".plant-grid-cell title")).map(
      (title) => title.textContent,
    ),
  ).toEqual(["Tomat", "En mycket lång växtbeteckning"]);
  expect(
    view.container.querySelectorAll(".structure-shape > title"),
  ).toHaveLength(0);
  expect(
    Array.from(view.container.querySelectorAll(".map-labels text")).map(
      (label) => label.textContent,
    ),
  ).toEqual(["Tomat"]);
  const cell = view.container.querySelector(".plant-grid-cell")!;
  const icon = view.container.querySelector(
    ".plant-grid-cell + .map-plant-icon",
  )!;
  const label = view.container.querySelector(".map-labels text")!;
  expect(cell).toHaveAttribute("rx", "0.06");
  expect(Number(icon.getAttribute("x"))).toBeCloseTo(0.15);
  expect(
    Number(icon.getAttribute("y")) + Number(icon.getAttribute("height")),
  ).toBeLessThan(Number(label.getAttribute("y")) - grid.geometry!.y);
  expect(
    Number(label.getAttribute("y")) -
      grid.geometry!.y -
      Number(icon.getAttribute("y")) -
      Number(icon.getAttribute("height")),
  ).toBeLessThan(0.05);
  expect(
    Number(label.getAttribute("y")) +
      Number(label.getAttribute("font-size")) * 0.2,
  ).toBeLessThan(grid.geometry!.y + 0.95);
});

test("a delayed move save keeps previews stable and cannot clear the next drag", async () => {
  class Point {
    constructor(
      public x: number,
      public y: number,
    ) {}
    matrixTransform() {
      return this;
    }
  }
  Object.defineProperty(globalThis, "DOMPoint", {
    configurable: true,
    value: Point,
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: MouseEvent,
  });
  Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
    configurable: true,
    value: () => ({ a: 1, inverse: () => ({}) }),
  });
  Object.defineProperty(SVGSVGElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => undefined,
  });

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
      x: 2,
      y: 3,
      width: 3,
      height: 2,
      rotation: 0,
    },
  });
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const onMove = jest.fn(
    (_record: typeof object, _geometry: typeof object.geometry) => pending,
  );
  const second = {
    ...object,
    id: crypto.randomUUID(),
    name: "Andra landet",
    geometry: { ...object.geometry!, x: 10 },
  };
  const view = render(
    <GardenMap
      garden={garden}
      records={[workspace, garden, object, second]}
      date="2027-04-01"
      selected={object.id}
      tool="move"
      grid
      snap={false}
      edgeSnap={false}
      structure
      plants
      onSelect={() => true}
      onCreate={() => undefined}
      onMove={onMove}
      onMoveMany={async () => true}
      onCancel={() => undefined}
    />,
  );
  const svg = view.getByRole("application");
  const shape = view.container.querySelector(".structure-shape")!;
  fireEvent.pointerDown(shape, { button: 0, clientX: 2, clientY: 3 });
  fireEvent.pointerMove(svg, { buttons: 1, clientX: 5, clientY: 6 });
  expect(shape).toHaveAttribute("transform", "translate(5 6) rotate(0)");

  fireEvent.pointerUp(svg);
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(shape).toHaveAttribute("transform", "translate(5 6) rotate(0)");

  fireEvent.pointerUp(svg);
  expect(onMove).toHaveBeenCalledTimes(1);
  // Cursor movement after release must not change the saving preview.
  fireEvent.pointerMove(svg, { buttons: 0, clientX: 9, clientY: 9 });
  expect(shape).toHaveAttribute("transform", "translate(5 6) rotate(0)");
  fireEvent.pointerMove(svg, { buttons: 1, clientX: 9, clientY: 9 });
  expect(shape).toHaveAttribute("transform", "translate(5 6) rotate(0)");
  const otherShape = view.container.querySelectorAll(".structure-shape")[1];
  fireEvent.pointerDown(otherShape, { button: 0, clientX: 10, clientY: 3 });
  fireEvent.pointerMove(svg, { buttons: 1, clientX: 12, clientY: 5 });
  expect(otherShape).toHaveAttribute("transform", "translate(12 5) rotate(0)");
  expect(view.container.querySelector(".draft")).not.toBeInTheDocument();
  await act(async () => {
    finish();
    await pending;
  });
  // Finishing the first save must not clear the second drag.
  expect(otherShape).toHaveAttribute("transform", "translate(12 5) rotate(0)");
  fireEvent.pointerMove(svg, { buttons: 1, clientX: 13, clientY: 6 });
  expect(otherShape).toHaveAttribute("transform", "translate(13 6) rotate(0)");
  expect(view.container.querySelector(".draft")).not.toBeInTheDocument();
  await act(async () => {
    fireEvent.pointerUp(svg);
  });
  expect(onMove).toHaveBeenCalledTimes(2);
  expect(onMove.mock.calls[1]).toEqual([
    second,
    expect.objectContaining({ x: 13, y: 6 }),
  ]);
});
