import { act, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GardenMap } from "../src/Map";
import { makeRecord } from "../src/domain";

test("a moved shape keeps its preview while persistence is pending", async () => {
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
  const onMove = jest.fn(() => pending);
  const view = render(
    <GardenMap
      garden={garden}
      records={[workspace, garden, object]}
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
  fireEvent.pointerMove(svg, { clientX: 5, clientY: 6 });
  expect(shape).toHaveAttribute("transform", "translate(5 6) rotate(0)");

  fireEvent.pointerUp(svg);
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(shape).toHaveAttribute("transform", "translate(5 6) rotate(0)");

  await act(async () => {
    finish();
    await pending;
  });
});
