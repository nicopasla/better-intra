/**
 * Cluster-computer components that can be reported as working or broken.
 * Keep the keys in sync with the worker's `SEAT_COMPONENTS` allowlist.
 */
export type SeatComponentKey =
  | "boot"
  | "network"
  | "keyboard"
  | "mouse_scroll"
  | "audio"
  | "usbc";

export type SeatSeverity = "blocking" | "minor";

/**
 * `defect` components are reported as working/broken and count towards the
 * seat's issue severity. `presence` components answer a yes/no question (does
 * this seat have the thing?) and never mark the seat as broken.
 */
export type SeatComponentKind = "defect" | "presence";

export interface SeatComponentDef {
  key: SeatComponentKey;
  label: string;
  severity: SeatSeverity;
  group: "usability" | "peripherals";
  /** Shown as working before anyone reports it (defaults to true). */
  assumeWorking?: boolean;
  kind?: SeatComponentKind;
  /** Labels for the two states; defaults to Working/Broken. */
  labels?: { on: string; off: string };
}

export const SEAT_COMPONENTS: SeatComponentDef[] = [
  { key: "boot", label: "Power", severity: "blocking", group: "usability" },
  {
    key: "network",
    label: "Network",
    severity: "blocking",
    group: "usability",
  },
  {
    key: "keyboard",
    label: "Keyboard",
    severity: "minor",
    group: "peripherals",
  },
  {
    key: "mouse_scroll",
    label: "Mouse scroll",
    severity: "minor",
    group: "peripherals",
  },
  { key: "audio", label: "Audio", severity: "minor", group: "peripherals" },
  {
    key: "usbc",
    label: "USB-C",
    severity: "minor",
    group: "peripherals",
    assumeWorking: false,
    kind: "presence",
    labels: { on: "Yes", off: "No" },
  },
];

export const SEAT_COMPONENT_MAP = new Map(
  SEAT_COMPONENTS.map((component) => [component.key, component]),
);

export const SEAT_COMPONENT_GROUPS: {
  title: string;
  components: SeatComponentDef[];
}[] = [
  {
    title: "Usability",
    components: SEAT_COMPONENTS.filter((c) => c.group === "usability"),
  },
  {
    title: "Peripherals",
    components: SEAT_COMPONENTS.filter((c) => c.group === "peripherals"),
  },
];
