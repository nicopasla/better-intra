export const HUB_INFO = {
  name: "Better Intra",
  version: "0.0.1",
  author: "https://github.com/nicopasla",
  github: "https://github.com/nicopasla/42-userscripts",
  issues: "https://github.com/nicopasla/42-userscripts/issues",
  license: "MIT",
} as const;

export const FEATURE_DEFS = [
  {
    id: "logtime",
    name: "Logtime",
    icon: "clock",
    desc: "Redesign the logtime to show weekly and total hours.",
  },
  {
    id: "clusters",
    name: "Clusters",
    icon: "grip-vertical",
    desc: "Adds 'chair' direction markers and a default cluster picker with saved preference.",
  },
  {
    id: "profile",
    name: "Profile",
    icon: "user",
    desc: "Improves readability and allows local profile/background image customization.",
  },
] as const;

export type FeatureId = (typeof FEATURE_DEFS)[number]["id"];
export const FEATURE_IDS = new Set<FeatureId>(FEATURE_DEFS.map((f) => f.id));

export const STORAGE_KEY = "ACTIVE_SCRIPTS";

export type SettingKind =
  | "toggle"
  | "number"
  | "text"
  | "url"
  | "select"
  | "color"
  | "radio-group"
  | "divider";

export type HubSettingDef = {
  feature: FeatureId;
  label: string;
  key?: string;
  desc?: string;
  kind: SettingKind;
  nullable?: boolean;
  defaultValue?: unknown;
  options?: readonly { label: string; value: string }[];
  grid?: boolean;
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
      label: "Monthly goal",
      desc: "Sets the target number of hour.",
      kind: "number",
      min: 0,
      step: 1,
      defaultValue: 140,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_AVERAGE",
      label: "Show average",
      desc: "Displays your average hours per day.",
      kind: "toggle",
      defaultValue: true,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_GOAL",
      label: "Show goal",
      desc: "Shows the goal indicator.",
      kind: "toggle",
      defaultValue: true,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_TACOS",
      label: "Show tacos",
      desc: "Enables the taco visual markers.",
      kind: "toggle",
      defaultValue: false,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_DAYS_MODE",
      label: "Day labels mode",
      desc: "Chooses how the day labels are displayed.",
      kind: "radio-group",
      defaultValue: "date",
      options: [
        { label: "17/04", value: "date" },
        { label: "17/04 (2 days ago)", value: "both" },
        { label: "2 days ago", value: "days" },
      ],
      grid: false,
    },
    {
      feature: "logtime",
      key: "LOGTIME_CALENDAR_COLOR",
      label: "Calendar color",
      desc: "Accent color used for the calendar.",
      kind: "color",
      placeholder: "#00BCBA",
      defaultValue: "#00BCBA",
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_LABELS_COLOR",
      label: "Labels color",
      desc: "Accent color used for labels and totals.",
      kind: "color",
      placeholder: "#26a641",
      defaultValue: "#26a641",
      grid: true,
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
      grid: true,
    },
    {
      feature: "clusters",
      key: "CLUSTERS_DEFAULT_ID",
      label: "Default cluster",
      desc: "Prefills a cluster ID when the page opens.",
      kind: "number",
      placeholder: "",
      defaultValue: "",
      grid: true,
    },
  ],
  profile: [
    {
      feature: "profile",
      label: "General",
      kind: "divider",
    },
    {
      feature: "profile",
      key: "PROFILE_SLOTS_REDIRECTION",
      label: "Slots button redirection",
      desc: "Redirects the 'Manage slots' button to the proper Slots webpage.",
      kind: "toggle",
      defaultValue: true,
    },

    {
      feature: "profile",
      label: "Events",
      kind: "divider",
    },
    {
      feature: "profile",
      key: "PROFILE_CAMPUS_FILTER",
      label: "Campus Display Mode",
      desc: "Choose which campus events to display on your profile.",
      kind: "radio-group",
      defaultValue: "all",
      options: [
        { label: "Show All", value: "all" },
        { label: "Brussels", value: "brussels" },
        { label: "Antwerp", value: "antwerp" },
      ],
    },
    {
      feature: "profile",
      key: "PROFILE_EVENT_TYPE_FILTER",
      label: "Event visibility",
      desc: "Choose which types of events you want to see.",
      kind: "radio-group",
      defaultValue: "all",
      options: [
        { label: "Show All", value: "all" },
        { label: "Exams", value: "exam" },
        { label: "Pedagogy", value: "pedago" },
        { label: "Social", value: "social" },
      ],
    },

    {
      feature: "profile",
      label: "Visual",
      kind: "divider",
    },
    {
      feature: "profile",
      key: "PROFILE_IMAGE_URL",
      label: "Profile image URL",
      desc: "Overrides the profile avatar image.",
      kind: "url",
      nullable: true,
      placeholder: "URL",
      defaultValue: "",
    },
    {
      feature: "profile",
      key: "PROFILE_BANNER_URL",
      label: "Banner image URL",
      desc: "Overrides the profile banner image.",
      kind: "url",
      nullable: true,
      placeholder: "",
      defaultValue: "",
    },
    {
      feature: "profile",
      key: "PROFILE_BACKGROUND_URL",
      label: "Background image URL",
      desc: "Overrides the profile background image.",
      kind: "url",
      nullable: true,
      placeholder: "",
      defaultValue: "",
    },
  ],
};

export type ShowDaysMode = "date" | "both" | "days";

export type LogtimeConfig = {
  LOGTIME_GOAL_HOURS: number;
  LOGTIME_SHOW_AVERAGE: boolean;
  LOGTIME_SHOW_GOAL: boolean;
  LOGTIME_SHOW_TACOS: boolean;
  LOGTIME_SHOW_DAYS_MODE: ShowDaysMode;
  LOGTIME_CALENDAR_COLOR: string;
  LOGTIME_LABELS_COLOR: string;
};

export const DEFAULT_LOGTIME_CONFIG: LogtimeConfig =
  HUB_SETTING_DEFS.logtime.reduce((acc, setting) => {
    if (setting.key) {
      (acc as any)[setting.key] = setting.defaultValue;
    }
    return acc;
  }, {} as LogtimeConfig);

export const LOGTIME_CONFIG_KEYS = Object.keys(
  DEFAULT_LOGTIME_CONFIG,
) as (keyof LogtimeConfig)[];
