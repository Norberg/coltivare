import type { Geometry, RecordData } from "./domain";
import type { PlantIconId } from "./plantAppearance";
import { containsShape } from "./geometry";

/** Stable, separated icon cells in local coordinates; independent of pan/zoom. */
export function mixtureLayout(geometry: Geometry, plants: RecordData[]) {
  const species = plants.filter(
    (plant): plant is RecordData & { icon: PlantIconId } =>
      !!plant.icon && plant.icon !== "none",
  );
  if (!species.length || geometry.width <= 0 || geometry.height <= 0) return [];
  const target = Math.min(
    48,
    Math.max(
      12,
      species.length * 3,
      Math.ceil(geometry.width * geometry.height),
    ),
  );
  const columns = Math.max(
    1,
    Math.min(
      target,
      Math.round(Math.sqrt((target * geometry.width) / geometry.height)),
    ),
  );
  const rows = Math.ceil(target / columns);
  const cellWidth = geometry.width / columns;
  const cellHeight = geometry.height / rows;
  const size = Math.min(cellWidth, cellHeight) * 0.62;
  const local = { ...geometry, x: 0, y: 0, rotation: 0 };
  const icons: {
    x: number;
    y: number;
    size: number;
    icon: PlantIconId;
    plantId: string;
  }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // Small deterministic offsets keep the mix from looking like rigid rows.
      const jitterX = (((row * 7 + column * 3) % 5) - 2) * 0.04;
      const jitterY = (((row * 3 + column * 7) % 5) - 2) * 0.04;
      const x = (column + 0.5 + jitterX) * cellWidth - size / 2;
      const y = (row + 0.5 + jitterY) * cellHeight - size / 2;
      if (
        geometry.shape !== "rectangle" &&
        !containsShape(local, {
          x,
          y,
          width: size,
          height: size,
          rotation: 0,
          shape: "rectangle",
        })
      )
        continue;
      const plant = species[(icons.length + row) % species.length];
      icons.push({ x, y, size, icon: plant.icon, plantId: plant.id });
    }
  }
  return icons;
}
