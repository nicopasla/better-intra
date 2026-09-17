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
  { id: "file", label: "Imported font" },
  { id: "system", label: "System default" },
] as const;

export const DEFAULT_GENERAL_FONT = "noto-sans";

export const IMPORTED_FONT_FAMILY = "BI Custom";

export const IMPORTED_FONT_MAX_BYTES = 4 * 1024 * 1024;

export const GENERAL_FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@100..900&family=Inter:wght@100..900&family=Roboto:wght@100..900&family=Open+Sans:wght@300..800&family=Source+Sans+3:wght@200..900&family=Work+Sans:wght@100..900&family=Manrope:wght@200..800&family=Atkinson+Hyperlegible+Next:wght@200..800&family=Ubuntu:wght@300;400;500;700&display=swap";

export function resolveSansStack(id: string): string {
  if (id === "file") return `"${IMPORTED_FONT_FAMILY}", ${SYSTEM_SANS_STACK}`;
  const option = SANS_FONTS.find((f) => f.id === id);
  if (!option?.family) return SYSTEM_SANS_STACK;
  return `"${option.family}", ${SYSTEM_SANS_STACK}`;
}
