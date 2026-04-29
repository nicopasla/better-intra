export const FEATURE_DEFS = [
  {
    id: "logtime",
    name: "Logtime",
    desc: "Redesign the logtime to show weekly and total hours on 42 Intra v3.",
  },
  {
    id: "clusters",
    name: "Clusters",
    desc: "Adds iMac direction markers and a default cluster picker with saved preference.",
  },
  {
    id: "profile",
    name: "Profile",
    desc: "Improves readability and allows local profile/background image customization.",
  },
] as const;

export type FeatureId = (typeof FEATURE_DEFS)[number]["id"];
export const FEATURE_IDS = new Set<FeatureId>(FEATURE_DEFS.map((f) => f.id));

export const STORAGE_KEY = "ACTIVE_SCRIPTS";

export const FEATURE_PAGE_GUARDS: Record<FeatureId, (loc: Location) => boolean> = {
  logtime: (loc) => loc.hostname === "profile-v3.intra.42.fr",
  profile: (loc) => loc.hostname === "profile-v3.intra.42.fr",
  clusters: (loc) =>
    loc.hostname === "meta.intra.42.fr" && loc.pathname.startsWith("/clusters"),
};

export const FEATURE_PAGE_URLS: Record<FeatureId, string> = {
  logtime: "https://profile-v3.intra.42.fr",
  profile: "https://profile-v3.intra.42.fr",
  clusters: "https://meta.intra.42.fr/clusters",
};

export const HUB_INFO = {
  name: "42 Intra Hub",
  version: "v1.0.0",
  author: "https://github.com/nicopasla",
  github: "https://github.com/nicopasla/42-userscripts",
  issues: "https://github.com/nicopasla/42-userscripts/issues",
  license: "MIT",
} as const;

export type SettingKind = "toggle" | "number" | "text" | "select";

export type HubSettingDef = {
  feature: FeatureId;
  key: string;
  label: string;
  desc: string;
  kind: SettingKind;
  nullable?: boolean;
  defaultValue?: unknown;
  options?: readonly { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

export const HUB_SETTING_DEFS: Record<FeatureId, readonly HubSettingDef[]> = {
  logtime: [
    {
      feature: "logtime",
      key: "LOGTIME_GOAL_HOURS",
      label: "Weekly goal",
      desc: "Sets the target number of hours used by the progress display.",
      kind: "number",
      min: 0,
      step: 1,
      defaultValue: 140,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_AVERAGE",
      label: "Show average",
      desc: "Displays your average hours per day.",
      kind: "toggle",
      defaultValue: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_GOAL",
      label: "Show goal",
      desc: "Shows the goal indicator in the logtime view.",
      kind: "toggle",
      defaultValue: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_TACOS",
      label: "Show tacos",
      desc: "Enables the taco visual markers in the calendar.",
      kind: "toggle",
      defaultValue: false,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_DAYS_MODE",
      label: "Day labels mode",
      desc: "Chooses how the day labels are displayed.",
      kind: "select",
      defaultValue: "date",
      options: [
        { label: "Date only", value: "date" },
        { label: "Date + day names", value: "both" },
        { label: "Day names only", value: "days" },
      ],
    },
    {
      feature: "logtime",
      key: "LOGTIME_CALENDAR_COLOR",
      label: "Calendar color",
      desc: "Accent color used for the calendar.",
      kind: "text",
      placeholder: "#00BCBA",
      defaultValue: "#00BCBA",
    },
    {
      feature: "logtime",
      key: "LOGTIME_LABELS_COLOR",
      label: "Labels color",
      desc: "Accent color used for labels and totals.",
      kind: "text",
      placeholder: "#26a641",
      defaultValue: "#26a641",
    },
  ],
  clusters: [
    {
      feature: "clusters",
      key: "CLUSTERS_SHOW_MARKERS",
      label: "Show markers",
      desc: "Shows the direction markers on the cluster screen.",
      kind: "toggle",
      defaultValue: true,
    },
    {
      feature: "clusters",
      key: "CLUSTERS_DEFAULT_ID",
      label: "Default cluster",
      desc: "Prefills a cluster ID when the page opens.",
      kind: "text",
      nullable: true,
      placeholder: "",
      defaultValue: "",
    },
  ],
  profile: [
    {
      feature: "profile",
      key: "PROFILE_IMAGE_URL",
      label: "Profile image URL",
      desc: "Overrides the profile avatar with a custom image URL.",
      kind: "text",
      nullable: true,
      placeholder: "",
      defaultValue: "",
    },
    {
      feature: "profile",
      key: "PROFILE_BACKGROUND_URL",
      label: "Background image URL",
      desc: "Overrides the profile background image.",
      kind: "text",
      nullable: true,
      placeholder: "",
      defaultValue: "",
    },
  ],
};

export type ShowDaysMode = "date" | "both" | "days";

// 1. Définir le type d'abord
export type LogtimeConfig = {
  LOGTIME_GOAL_HOURS: number;
  LOGTIME_SHOW_AVERAGE: boolean;
  LOGTIME_SHOW_GOAL: boolean;
  LOGTIME_SHOW_TACOS: boolean;
  LOGTIME_SHOW_DAYS_MODE: ShowDaysMode;
  LOGTIME_CALENDAR_COLOR: string;
  LOGTIME_LABELS_COLOR: string;
};

export const DEFAULT_LOGTIME_CONFIG: LogtimeConfig = HUB_SETTING_DEFS.logtime.reduce(
  (acc, setting) => {
    (acc as any)[setting.key] = setting.defaultValue;
    return acc;
  },
  {} as LogtimeConfig
);

export const LOGTIME_CONFIG_KEYS = Object.keys(
  DEFAULT_LOGTIME_CONFIG
) as (keyof LogtimeConfig)[];