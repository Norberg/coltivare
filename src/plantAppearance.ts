export const plantIcons = {
  oregano: "Oregano",
  lavender: "Lavendel",
  spinach: "Spenat",
  cornflower: "Blåklint",
  rose: "Ros",
  tulip: "Tulpan",
  pumpkin: "Pumpa",
  zucchini: "Zucchini",
  carrot: "Morot",
  tomato: "Tomat",
  chard: "Mangold",
  yellowOnion: "Gul lök",
  redOnion: "Röd lök",
  rosemary: "Rosmarin",
  potato: "Potatis",
  peas: "Ärtor",
  oleander: "Oleander",
  peony: "Pion",
  crocus: "Krokus",
  lobelia: "Lobelia",
  calendula: "Ringblomma",
  // Kept for backwards-compatible saved icon IDs; the illustration is Aubrietia.
  blueFescue: "Aubrietia",
  sweetWilliam: "Borstnejlika",
  lettuce: "Sallat",
  arugula: "Ruccula",
  baikal: "Bajkal",
  hyacinth: "Hyacint",
  grapeHyacinth: "Pärlhyacint",
  raspberry: "Hallonbuske",
  blueberry: "Blåbärsbuske",
} as const;
export type PlantIconId = keyof typeof plantIcons;

export type PlantIconVariantId =
  | "blue"
  | "apricot"
  | "pink"
  | "red"
  | "purple"
  | "white"
  | "yellow"
  | "littleBeauty";

export const plantIconVariants: Partial<
  Record<PlantIconId, Partial<Record<PlantIconVariantId, string>>>
> = {
  hyacinth: { blue: "Blå", apricot: "Aprikos" },
  rose: {
    pink: "Rosa",
    red: "Röd",
    white: "Vit",
    yellow: "Gul",
    apricot: "Aprikos",
  },
  tulip: {
    pink: "Rosa",
    red: "Röd",
    purple: "Lila",
    white: "Vit",
    yellow: "Gul",
    littleBeauty: "Little Beauty",
  },
  crocus: { blue: "Blå", white: "Vit", purple: "Lila" },
};

export function defaultPlantIconVariant(
  icon: PlantIconId,
): PlantIconVariantId | undefined {
  return Object.keys(plantIconVariants[icon] || {})[0] as
    | PlantIconVariantId
    | undefined;
}

export function plantIconLabel(
  icon: PlantIconId,
  variant?: PlantIconVariantId,
) {
  const variantLabel = variant && plantIconVariants[icon]?.[variant];
  return variantLabel ? `${plantIcons[icon]} – ${variantLabel}` : plantIcons[icon];
}
