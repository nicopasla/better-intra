import CLOCK from "../../assets/svg/clock.svg?raw";
import CLUSTERS from "../../assets/svg/grip-vertical.svg?raw";
import USER from "../../assets/svg/user.svg?raw";
import SHORTCUT from "../../assets/svg/shortcut.svg?raw";
import CLOUD from "../../assets/svg/cloud.svg?raw";
import { CONFIG_DEFAULT, ConfigKey } from "../../config.ts";

export const HUB_INFO = {
  name: "Better Intra",
  version: "0.2.0",
  author: "https://github.com/nicopasla",
  github: "https://github.com/nicopasla/better-intra",
  issues: "https://github.com/nicopasla/better-intra/issues",
  license: "MIT",
} as const;

export const FEATURE_DEFS = [
  {
    id: "logtime",
    name: "Logtime",
    icon: CLOCK,
    desc: "Redesign the logtime to show weekly and total hours.",
  },
  {
    id: "clusters",
    name: "Clusters",
    icon: CLUSTERS,
    desc: "Adds 'chair' direction markers and a default cluster picker with saved preference.",
  },
  {
    id: "profile",
    name: "Profile",
    icon: USER,
    desc: "Improves readability and allows local profile/background image customization.",
  },
  {
    id: "shortcuts",
    name: "Shortcuts",
    icon: SHORTCUT,
    desc: "Manage custom navigation links.",
  },
  {
    id: "account",
    name: "Account",
    icon: CLOUD,
    desc: "Sync your settings to the cloud and manage your session.",
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
  | "divider"
  | "shortcuts"
  | "emoji"
  | "account";

export const INTRA_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export type HubSettingDef = {
  feature: FeatureId;
  label: string;
  key?: ConfigKey;
  desc?: string;
  kind: SettingKind;
  nullable?: boolean;
  defaultValue?: unknown;
  options?: readonly { label: string; value: string }[];
  grid?: boolean;
  fullWidth?: boolean;
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
      defaultValue: CONFIG_DEFAULT.LOGTIME_GOAL_HOURS,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_AVERAGE",
      label: "Show average",
      desc: "Displays your average hours per day.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.LOGTIME_SHOW_AVERAGE,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_GOAL",
      label: "Show goal",
      desc: "Shows the goal indicator.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.LOGTIME_SHOW_GOAL,
      grid: true,
    },
    {
      feature: "logtime",
      key: "DISABLE_ANIMATIONS",
      label: "Disable Animations",
      desc: "Removes transition effects.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.DISABLE_ANIMATIONS,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_TACOS",
      label: "Show emoji",
      desc: "Enables the emoji visual markers.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.LOGTIME_SHOW_TACOS,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_EMOJI",
      label: "Custom Emoji",
      desc: "Replace 🌮 with your 3 favorites emojis.",
      kind: "emoji",
      placeholder: "🌮",
      defaultValue: CONFIG_DEFAULT.LOGTIME_EMOJI,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_EMOJI_DIVISOR",
      label: "Emoji Value",
      desc: "Value of the emoji.",
      kind: "number",
      defaultValue: CONFIG_DEFAULT.LOGTIME_EMOJI_DIVISOR,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_EMOJI_RATE",
      label: "Hourly Earning",
      desc: "How much you earn per hour.",
      kind: "number",
      defaultValue: CONFIG_DEFAULT.LOGTIME_EMOJI_RATE,
      grid: true,
    },

    {
      feature: "logtime",
      key: "LOGTIME_SHOW_DAYS_MODE",
      label: "Day labels mode",
      desc: "Chooses how the day labels are displayed.",
      kind: "radio-group",
      defaultValue: CONFIG_DEFAULT.LOGTIME_SHOW_DAYS_MODE,
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
      defaultValue: CONFIG_DEFAULT.LOGTIME_CALENDAR_COLOR,
      grid: true,
    },
    {
      feature: "logtime",
      key: "LOGTIME_LABELS_COLOR",
      label: "Labels color",
      desc: "Accent color used for labels and totals.",
      kind: "color",
      placeholder: "#26a641",
      defaultValue: CONFIG_DEFAULT.LOGTIME_LABELS_COLOR,
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
      defaultValue: CONFIG_DEFAULT.CLUSTERS_SHOW_MARKERS,
      grid: true,
    },
    {
      feature: "clusters",
      key: "CLUSTERS_DEFAULT_ID",
      label: "Default cluster",
      desc: "Prefills a cluster ID when the page opens.",
      kind: "number",
      placeholder: "",
      defaultValue: CONFIG_DEFAULT.CLUSTERS_DEFAULT_ID,
      grid: true,
    },
  ],
  profile: [
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
      defaultValue: CONFIG_DEFAULT.PROFILE_CAMPUS_FILTER,
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
      defaultValue: CONFIG_DEFAULT.PROFILE_EVENT_TYPE_FILTER,
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
      fullWidth: true,
      nullable: true,
      placeholder: "URL",
      defaultValue: CONFIG_DEFAULT.PROFILE_IMAGE_URL,
    },
    {
      feature: "profile",
      key: "PROFILE_BANNER_URL",
      label: "Banner image URL",
      desc: "Overrides the profile banner image.",
      kind: "url",
      fullWidth: true,
      nullable: true,
      placeholder: "",
      defaultValue: CONFIG_DEFAULT.PROFILE_BANNER_URL,
    },
    {
      feature: "profile",
      key: "PROFILE_BACKGROUND_URL",
      label: "Background image URL",
      desc: "Overrides the profile background image.",
      kind: "url",
      fullWidth: true,
      nullable: true,
      placeholder: "",
      defaultValue: CONFIG_DEFAULT.PROFILE_BACKGROUND_URL,
    },

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
      defaultValue: CONFIG_DEFAULT.PROFILE_SLOTS_REDIRECTION,
    },
  ],
  shortcuts: [
    {
      feature: "shortcuts",
      key: "SHORTCUTS_LINKS",
      label: "",
      kind: "shortcuts",
      fullWidth: true,
    },
  ],
  account: [
    {
      feature: "account",
      key: "ACCOUNT",
      label: "",
      kind: "account",
      fullWidth: true,
    },
  ],
};
