// SVG/DOM tests need no GPU or hardware inventory. CPU rendering also makes
// the suite usable in restricted CI without access to /sys/bus/pci.
export const browserArguments = ["--disable-gpu", "--use-gl=disabled"];
