import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RecordForm } from "../src/Forms";
import { makeRecord } from "../src/domain";
import { Field } from "../src/Forms";
import { formatMeters } from "../src/format";

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
