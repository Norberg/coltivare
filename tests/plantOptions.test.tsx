import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { makeRecord } from "../src/domain";
import { PlantSelectOptions } from "../src/PlantOptions";

test("plant choices identify standard and user-added plants", () => {
  const workspaceId = crypto.randomUUID();
  const standard = makeRecord("plant", workspaceId, {
    name: "Tomat",
    icon: "tomato",
    defaultPlantKey: "tomato",
  });
  const custom = makeRecord("plant", workspaceId, {
    name: "Tomat Roma",
    icon: "tomato",
  });
  render(
    <select aria-label="Växt">
      <PlantSelectOptions records={[custom, standard]} />
    </select>,
  );
  expect(
    screen.getByRole("group", { name: "Standardväxter" }),
  ).toContainElement(screen.getByRole("option", { name: "Tomat" }));
  expect(screen.getByRole("group", { name: "Egna växter" })).toContainElement(
    screen.getByRole("option", { name: "Tomat Roma" }),
  );
});
