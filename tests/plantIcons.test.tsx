import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlantIcon } from "../src/PlantIcon";
import {
  plantIcons,
  plantIconVariants,
  type PlantIconId,
  type PlantIconVariantId,
} from "../src/plantAppearance";
import { makeRecord, validateRecords } from "../src/domain";

test.each(Object.entries(plantIcons) as [PlantIconId, string][])(
  "%s has a local illustration, accessible name and valid stored ID",
  (icon, label) => {
    render(<PlantIcon icon={icon} />);
    const svg = screen.getByRole("img", { name: label });
    expect(svg).toHaveAttribute("viewBox", "0 0 64 64");
    expect(svg.querySelectorAll("path,ellipse,circle").length).toBeGreaterThan(
      0,
    );
    const w = makeRecord("workspace", crypto.randomUUID());
    w.workspaceId = w.id;
    expect(() =>
      validateRecords([w, makeRecord("plant", w.id, { name: label, icon })]),
    ).not.toThrow();
  },
);

test.each(
  Object.entries(plantIconVariants) as [
    PlantIconId,
    Partial<Record<PlantIconVariantId, string>>,
  ][],
)("%s renders every named flower variant distinctly", (icon, variants) => {
  const drawings = new Set<string>();
  for (const [variant, label] of Object.entries(variants)) {
    const view = render(
      <PlantIcon icon={icon} variant={variant as PlantIconVariantId} />,
    );
    const svg = screen.getByRole("img", {
      name: `${plantIcons[icon]} – ${label}`,
    });
    drawings.add(svg.innerHTML);
    view.unmount();
  }
  expect(drawings.size).toBe(Object.keys(variants).length);
});
