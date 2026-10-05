export interface FontOption {
  id: string;
  label: string;
  family?: string;
}

export const SYSTEM_SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const SANS_FONTS: readonly FontOption[] = [
  { id: "noto-sans", label: "Noto Sans", family: "Noto Sans" },
  { id: "inter", label: "Inter", family: "Inter" },
  { id: "roboto", label: "Roboto", family: "Roboto" },
  { id: "open-sans", label: "Open Sans", family: "Open Sans" },
  { id: "source-sans-3", label: "Source Sans 3", family: "Source Sans 3" },
  { id: "work-sans", label: "Work Sans", family: "Work Sans" },
  { id: "manrope", label: "Manrope", family: "Manrope" },
  {
    id: "atkinson-hyperlegible-next",
    label: "Atkinson Hyperlegible Next",
    family: "Atkinson Hyperlegible Next",
  },
  { id: "ubuntu", label: "Ubuntu", family: "Ubuntu" },
  { id: "poppins", label: "Poppins", family: "Poppins" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat" },
  { id: "lato", label: "Lato", family: "Lato" },
  { id: "nunito-sans", label: "Nunito Sans", family: "Nunito Sans" },
  { id: "raleway", label: "Raleway", family: "Raleway" },
  { id: "rubik", label: "Rubik", family: "Rubik" },
  { id: "dm-sans", label: "DM Sans", family: "DM Sans" },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", family: "IBM Plex Sans" },
  {
    id: "plus-jakarta-sans",
    label: "Plus Jakarta Sans",
    family: "Plus Jakarta Sans",
  },
  { id: "outfit", label: "Outfit", family: "Outfit" },
  { id: "karla", label: "Karla", family: "Karla" },
  { id: "mulish", label: "Mulish", family: "Mulish" },
  { id: "public-sans", label: "Public Sans", family: "Public Sans" },
  { id: "space-grotesk", label: "Space Grotesk", family: "Space Grotesk" },
  { id: "sora", label: "Sora", family: "Sora" },
  { id: "figtree", label: "Figtree", family: "Figtree" },
  { id: "lexend", label: "Lexend", family: "Lexend" },
  { id: "jost", label: "Jost", family: "Jost" },
  {
    id: "red-hat-display",
    label: "Red Hat Display",
    family: "Red Hat Display",
  },
  { id: "doto", label: "Doto", family: "Doto" },
  { id: "file", label: "Imported font" },
  { id: "system", label: "System default" },
] as const;

export const DEFAULT_GENERAL_FONT = "noto-sans";

export const IMPORTED_FONT_FAMILY = "BI Custom";

export const IMPORTED_FONT_MAX_BYTES = 4 * 1024 * 1024;

export interface ImportedFontEntry {
  name: string;
  dataUri: string;
}

export function addFontToHistory(
  history: readonly ImportedFontEntry[],
  entry: ImportedFontEntry,
  max = 3,
): ImportedFontEntry[] {
  if (!entry.name || !entry.dataUri) return [...history];
  const filtered = history.filter((h) => h.name !== entry.name);
  return [entry, ...filtered].slice(0, max);
}

export const GENERAL_FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@100..900&family=Inter:wght@100..900&family=Roboto:wght@100..900&family=Open+Sans:wght@300..800&family=Source+Sans+3:wght@200..900&family=Work+Sans:wght@100..900&family=Manrope:wght@200..800&family=Atkinson+Hyperlegible+Next:wght@200..800&family=Ubuntu:wght@300;400;500;700&family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@100..900&family=Lato:wght@300;400;700;900&family=Nunito+Sans:wght@200..1000&family=Raleway:wght@100..900&family=Rubik:wght@300..900&family=DM+Sans:wght@100..1000&family=IBM+Plex+Sans:wght@100;200;300;400;500;600;700&family=Plus+Jakarta+Sans:wght@200..800&family=Outfit:wght@100..900&family=Karla:wght@200..800&family=Mulish:wght@200..1000&family=Public+Sans:wght@100..900&family=Space+Grotesk:wght@300..700&family=Sora:wght@100..800&family=Figtree:wght@300..900&family=Lexend:wght@100..900&family=Jost:wght@100..900&family=Red+Hat+Display:wght@300..900&family=Doto:wght@100..900&display=swap";

export function resolveSansStack(id: string): string {
  if (id === "file") return `"${IMPORTED_FONT_FAMILY}", ${SYSTEM_SANS_STACK}`;
  const option = SANS_FONTS.find((f) => f.id === id);
  if (!option?.family) return SYSTEM_SANS_STACK;
  return `"${option.family}", ${SYSTEM_SANS_STACK}`;
}
