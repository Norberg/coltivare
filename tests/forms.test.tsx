import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RecordForm } from "../src/Forms";
import { makeRecord } from "../src/domain";
import { Field } from "../src/Forms";
import { formatMeters } from "../src/format";

test("grid dimensions preserve existing cells and each cell can select a plant", async () => {
  const workspaceId = crypto.randomUUID();
  const plant = makeRecord("plant", workspaceId, { name: "Tomat" });
  const grid = makeRecord("plantGrid", workspaceId, {
    name: "Rutnät",
    columns: 1,
    rows: 3,
    cellPlantIds: [null, plant.id, null],
    geometry: {
      x: 0,
      y: 0,
      width: 2,
      height: 3,
      rotation: 0,
      shape: "rectangle",
    },
  });
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecordForm
      record={grid}
      records={[plant]}
      save={save}
      cancel={() => {}}
      onDirty={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Kolumner"), {
    target: { value: "4" },
  });
  fireEvent.change(screen.getByLabelText("Rad 1, kolumn 1"), {
    target: { value: plant.id },
  });
  fireEvent.click(screen.getByText("Spara"));
  expect(save.mock.calls[0][0][0].after.cellPlantIds).toEqual([
    plant.id,
    null,
    null,
    null,
    plant.id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
});

test.each(["rectangle", "ellipse", "polygon"] as const)(
  "%s geometry offers no new polygons or corner editing and preserves untouched data",
  async (shape) => {
    const record = makeRecord("object", crypto.randomUUID());
    record.geometry = {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      rotation: 0,
      shape,
      ...(shape === "polygon"
        ? {
            points: [
              { x: 0, y: 0 },
              { x: 3, y: 0 },
              { x: 0, y: 4 },
            ],
          }
        : {}),
    };
    const save = jest.fn().mockResolvedValue(undefined);
    render(
      <RecordForm
        record={record}
        records={[]}
        save={save}
        cancel={() => {}}
        onDirty={() => {}}
      />,
    );
    const form = screen.getByLabelText("Form") as HTMLSelectElement;
    expect(
      Array.from(form.options)
        .filter((option) => !option.disabled)
        .map((option) => option.value),
    ).toEqual(["rectangle", "ellipse"]);
    expect(form).toHaveValue(shape);
    expect(
      screen.queryByText("Polygonens hörn (lokala meter)"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Spara"));
    expect(save.mock.calls[0][0][0].after.geometry).toEqual(record.geometry);
    if (shape === "polygon") {
      fireEvent.change(form, { target: { value: "rectangle" } });
      fireEvent.click(screen.getByText("Spara"));
      expect(save.mock.calls[1][0][0].after.geometry).toEqual({
        ...record.geometry,
        shape: "rectangle",
        points: undefined,
      });
    }
  },
);

test("map labels are visible by default and can be hidden persistently", async () => {
  const record = makeRecord("object", crypto.randomUUID(), {
    geometry: {
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      rotation: 0,
      shape: "rectangle",
    },
  });
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecordForm
      record={record}
      records={[]}
      save={save}
      cancel={() => {}}
      onDirty={() => {}}
    />,
  );
  const showName = screen.getByLabelText("Visa namn på trädgårdsvyn");
  expect(showName).toBeChecked();
  fireEvent.click(showName);
  fireEvent.click(screen.getByText("Spara"));
  expect(save.mock.calls[0][0][0].after.showName).toBe(false);
});

test("flower icon color variants are selected and saved together", () => {
  const record = makeRecord("plant", crypto.randomUUID(), { name: "Hyacint" });
  const save = jest.fn().mockResolvedValue(undefined);
  render(
    <RecordForm
      record={record}
      records={[]}
      save={save}
      cancel={() => {}}
      onDirty={() => {}}
    />,
  );
  for (const icon of ["Sallat", "Ärtor", "Ruccula", "Bajkal", "Pärlhyacint"])
    expect(screen.getByRole("button", { name: `Ikon: ${icon}` })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Ikon: Ros" }));
  expect(
    Array.from(
      (screen.getByLabelText("Färg/variant för växtikon") as HTMLSelectElement)
        .options,
    ).map((option) => option.text),
  ).toEqual(["Rosa", "Röd", "Vit", "Gul", "Aprikos"]);
  fireEvent.click(screen.getByRole("button", { name: "Ikon: Hyacint" }));
  fireEvent.change(screen.getByLabelText("Färg/variant för växtikon"), {
    target: { value: "apricot" },
  });
  fireEvent.click(screen.getByText("Spara"));
  expect(save.mock.calls[0][0][0].after).toMatchObject({
    icon: "hyacinth",
    iconVariant: "apricot",
  });
});

test("meters use at most two decimals without changing untouched geometry", () => {
  expect(formatMeters(4)).toBe("4");
  expect(formatMeters(1.2)).toBe("1,2");
  expect(formatMeters(1.235)).toBe("1,24");
  expect(formatMeters(-1.235)).toBe("-1,24");
  expect(formatMeters(-0.00001)).toBe("0");
  const change = jest.fn();
  render(<Field label="X (m)" value={1.23456789} meters onChange={change} />);
  const input = screen.getByLabelText("X (m)");
  expect(input).toHaveValue("1,23");
  fireEvent.blur(input);
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "2,3456" } });
  fireEvent.blur(input);
  expect(input).toHaveValue("2,35");
  expect(change).toHaveBeenLastCalledWith("2,35");
  fireEvent.change(input, { target: { value: "3.456" } });
  fireEvent.blur(input);
  expect(input).toHaveValue("3,46");
  expect(change).toHaveBeenLastCalledWith("3,46");
});
test("failed storage preserves typed input and reports the error", async () => {
  const record = makeRecord("plant", crypto.randomUUID());
  const save = jest.fn().mockRejectedValue(Error("Lagringsutrymmet är fullt."));
  render(
    <RecordForm
      record={record}
      records={[]}
      save={save}
      cancel={() => {}}
      onDirty={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Namn"), {
    target: { value: "Min egen sort" },
  });
  fireEvent.click(screen.getByText("Spara"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Lagringsutrymmet är fullt.",
  );
  expect(screen.getByLabelText("Namn")).toHaveValue("Min egen sort");
});
test("decimal comma remains editable until the numeric field is committed", () => {
  const change = jest.fn();
  render(<Field label="Bredd" value={1} onChange={change} />);
  const input = screen.getByLabelText("Bredd");
  fireEvent.change(input, { target: { value: "1," } });
  expect(input).toHaveValue("1,");
  fireEvent.change(input, { target: { value: "1,2" } });
  fireEvent.blur(input);
  expect(change).toHaveBeenCalledWith("1,2");
});
