import {
  contrastText,
  mixToward,
  perceptualLuminance,
  toRgba,
} from "../../utils/color";

const rgbaCache = new Map<string, string>();

export function limit(s: unknown): string {
  return Array.from(typeof s === "string" ? s : "🌮")
    .slice(0, 3)
    .join("");
}

export const fmtHours = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
};

export function hexToRgba(hex: string, opacity: number): string {
  const key = `${hex}|${opacity}`;
  const cached = rgbaCache.get(key);
  if (cached) return cached;
  const value = toRgba(hex, opacity);
  rgbaCache.set(key, value);
  return value;
}

export function contrastTextColor(hex: string): string {
  return contrastText(hex);
}

export function safeLabelsColor(color: string, theme: string): string {
  const isDark = theme === "dark" || theme === "dim";
  const luminance = perceptualLuminance(color);

  if (isDark && luminance < 100) {
    return mixToward(color, "#ffffff", 0.5);
  }
  if (!isDark && luminance > 200) {
    return mixToward(color, "#000000", 0.5);
  }
  return color;
}

export const getLastSeenFormatted = (
  stats: Record<string, string>,
  mode: "date" | "both" | "days" = "date",
): string => {
  const activeDays = Object.entries(stats)
    .filter(([, time]) => time !== "00:00:00")
    .map(([date]) => date)
    .sort();

  if (activeDays.length === 0) return "N/A";
  const lastDateStr = activeDays[activeDays.length - 1];
  if (mode === "date") {
    const [, m, d] = lastDateStr.split("-");
    return `${d}/${m}`;
  }

  const lastDate = new Date(lastDateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (today.getTime() - lastDate.getTime()) / 86400000,
  );

  const relative =
    diffDays === 0
      ? "today"
      : diffDays === 1
        ? "yesterday"
        : `${diffDays} days ago`;
  if (mode === "days") return relative;

  const [, m, d] = lastDateStr.split("-");
  return `${d}/${m} (${relative})`;
};
