import CLOCK from "../../assets/svg/clock.svg?raw";
import CLUSTERS from "../../assets/svg/grip-vertical.svg?raw";
import USER from "../../assets/svg/user.svg?raw";
import SHORTCUT from "../../assets/svg/shortcut.svg?raw";
import ABOUT from "../../assets/svg/about.svg?raw";
import { CONFIG_DEFAULT, ConfigKey } from "../../config.ts";
import { CLUSTERS as CLUSTER_OPTIONS } from "../clusters/clusters.data.ts";

export const HUB_INFO = {
  name: "Better Intra",
  version: __APP_VERSION__,
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
    cols: 3,
  },
  {
    id: "clusters",
    name: "Clusters",
    icon: CLUSTERS,
    desc: "Adds 'chair' direction markers and a default cluster picker with saved preference.",
    cols: 2,
  },
  {
    id: "profile",
    name: "Profile",
    icon: USER,
    desc: "Improves readability and allows local profile/background image customization.",
    cols: 2,
  },
  {
    id: "shortcuts",
    name: "Shortcuts",
    icon: SHORTCUT,
    desc: "Manage custom navigation links.",
    cols: 3,
  },
  {
    id: "about",
    name: "About",
    icon: ABOUT,
    desc: "Information about Better Intra and its technical stack.",
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
  | "about"
  | "card-order";

export { INTRA_FONT } from "../logtime/constants.ts";

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
  colSpan?: number;
  fullWidth?: boolean;
  dependsOn?: ConfigKey;
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
      colSpan: 1,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_AVERAGE",
      label: "Show average",
      desc: "Displays average hours per active day.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.LOGTIME_SHOW_AVERAGE,
      grid: true,
      colSpan: 1,
    },
    {
      feature: "logtime",
      key: "LOGTIME_SHOW_GOAL",
      label: "Show goal",
      desc: "Shows the goal indicator.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.LOGTIME_SHOW_GOAL,
      grid: true,
      colSpan: 1,
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

    { feature: "logtime", label: "Emoji & Earnings", kind: "divider" },

    {
      feature: "logtime",
      key: "LOGTIME_SHOW_TACOS",
      label: "Show emoji",
      desc: "Enables the emoji visual markers.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.LOGTIME_SHOW_TACOS,
      grid: true,
      colSpan: 1,
    },
    {
      feature: "logtime",
      key: "LOGTIME_EMOJI",
      label: "Custom Emoji",
      desc: "Replace 🌮 with your favorite emoji.",
      kind: "emoji",
      placeholder: "🌮🌮🌮",
      defaultValue: CONFIG_DEFAULT.LOGTIME_EMOJI,
      grid: true,
      colSpan: 1,
      dependsOn: "LOGTIME_SHOW_TACOS",
    },
    {
      feature: "logtime",
      key: "LOGTIME_EMOJI_DIVISOR",
      label: "Emoji Value",
      desc: "Value of the emoji.",
      kind: "number",
      defaultValue: CONFIG_DEFAULT.LOGTIME_EMOJI_DIVISOR,
      grid: true,
      colSpan: 1,
      dependsOn: "LOGTIME_SHOW_TACOS",
    },
    {
      feature: "logtime",
      key: "LOGTIME_EMOJI_RATE",
      label: "Hourly Earning",
      desc: "How much you earn per hour.",
      kind: "number",
      defaultValue: CONFIG_DEFAULT.LOGTIME_EMOJI_RATE,
      grid: true,
      colSpan: 1,
      dependsOn: "LOGTIME_SHOW_TACOS",
    },
    {
      feature: "logtime",
      key: "LOGTIME_MAX_EARNINGS",
      label: "Max Earnings",
      desc: "Cap on total earnings per month.",
      kind: "number",
      defaultValue: CONFIG_DEFAULT.LOGTIME_MAX_EARNINGS,
      grid: true,
      colSpan: 1,
      dependsOn: "LOGTIME_SHOW_TACOS",
    },

    { feature: "logtime", label: "Appearance", kind: "divider" },

    {
      feature: "logtime",
      key: "LOGTIME_CALENDAR_COLOR",
      label: "Calendar color",
      desc: "Accent color used for the calendar.",
      kind: "color",
      placeholder: "#00BCBA",
      defaultValue: CONFIG_DEFAULT.LOGTIME_CALENDAR_COLOR,
      grid: true,
      colSpan: 1,
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
      colSpan: 1,
    },
    {
      feature: "logtime",
      key: "DISABLE_ANIMATIONS",
      label: "Disable Animations",
      desc: "Removes transition effects.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.DISABLE_ANIMATIONS,
      grid: true,
      colSpan: 1,
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
      colSpan: 1,
    },
    {
      feature: "clusters",
      key: "CLUSTERS_DEFAULT_ID",
      label: "Default cluster",
      desc: "Prefills a cluster page when the page opens.",
      kind: "select",
      defaultValue: String(CONFIG_DEFAULT.CLUSTERS_DEFAULT_ID),
      options: CLUSTER_OPTIONS.map((c) => ({
        label: c.name.toUpperCase(),
        value: c.id,
      })),
      grid: true,
      colSpan: 1,
    },
  ],
  profile: [
    {
      feature: "profile",
      key: "PROFILE_CARD_ORDER",
      label: "Dashboard Cards Order",
      desc: "Drag and drop the colored cards to prioritize your dashboard sections.",
      kind: "card-order",
      fullWidth: true,
      defaultValue: CONFIG_DEFAULT.PROFILE_CARD_ORDER,
    },
    {
      feature: "profile",
      key: "PROFILE_USE_CUSTOM_COLOR",
      label: "Use custom color on card",
      desc: "Applies the logtime calendar color to the profile card.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.PROFILE_USE_CUSTOM_COLOR,
      grid: true,
      colSpan: 1,
    },
    {
      feature: "profile",
      key: "PROFILE_SLOTS_REDIRECTION",
      label: "Slots button redirection",
      desc: "Redirects the 'Manage slots' button to the proper Slots webpage.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.PROFILE_SLOTS_REDIRECTION,
      grid: true,
      colSpan: 1,
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
        { label: "Exam", value: "exam" },
        { label: "Conference", value: "conference" },
        { label: "Workshop", value: "workshop" },
        { label: "Hackathon", value: "hackathon" },
        { label: "Event", value: "event" },
        { label: "Meet up", value: "meet_up" },
      ],
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
    {
      feature: "shortcuts",
      key: "SHORTCUTS_HIDE_IMPORTANT_LINKS",
      label: "Hide important links",
      desc: "Hides the default Intra important links on the profile to give shortcuts the full width.",
      kind: "toggle",
      defaultValue: CONFIG_DEFAULT.SHORTCUTS_HIDE_IMPORTANT_LINKS,
      grid: true,
      colSpan: 1,
    },
    {
      feature: "shortcuts",
      key: "SHORTCUTS_ALIGNMENT",
      label: "Shortcuts alignment",
      desc: "Aligns shortcuts left, center, or right when important links are hidden.",
      kind: "select",
      defaultValue: CONFIG_DEFAULT.SHORTCUTS_ALIGNMENT,
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ] as const,
      dependsOn: "SHORTCUTS_HIDE_IMPORTANT_LINKS",
      grid: true,
      colSpan: 2,
    },
  ],
  about: [
    {
      feature: "about",
      label: "",
      kind: "about",
      fullWidth: true,
    },
  ],
};
