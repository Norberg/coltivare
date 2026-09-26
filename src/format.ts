const meters = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

/** Display precision only; geometry calculations retain their full precision. */
export function formatMeters(value: number): string {
  const formatted = meters.format(value).replace("−", "-");
  return formatted === "-0" ? "0" : formatted;
}
