import { gmGetValue, gmSetValue } from "../../lib/gm.ts";
import {
  FEATURE_DEFS,
  FEATURE_IDS,
  STORAGE_KEY,
  FeatureId,
} from "./hubSettings.data.ts";

function normalizeActive(raw: unknown): FeatureId[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) {
    return FEATURE_DEFS.map((f) => f.id);
  }
  const ids = parsed.filter((v): v is FeatureId =>
    FEATURE_IDS.has(v as FeatureId),
  );
  return ids.length ? ids : FEATURE_DEFS.map((f) => f.id);
}

export function getActiveFeatures(): FeatureId[] {
  const raw = gmGetValue<unknown>(STORAGE_KEY, null);
  const active = normalizeActive(raw);
  gmSetValue(STORAGE_KEY, JSON.stringify(active));
  return active;
}
