import { getConfig, parseLegacyJson, setConfig } from "../../config.ts";
import {
  FEATURE_DEFS,
  FEATURE_IDS,
  STORAGE_KEY,
  FeatureId,
} from "./hubSettings.data.ts";

function normalizeActive(raw: unknown): FeatureId[] {
  const parsed = parseLegacyJson(raw);

  if (!Array.isArray(parsed)) {
    return FEATURE_DEFS.map((f) => f.id);
  }

  if (parsed.length === 0) return [];

  const ids = (parsed as string[]).filter((v): v is FeatureId =>
    FEATURE_IDS.has(v as FeatureId),
  );

  if (ids.length === 0) return FEATURE_DEFS.map((f) => f.id);

  return ids;
}

export async function getActiveFeatures(): Promise<FeatureId[]> {
  const raw = await getConfig(STORAGE_KEY);
  const active = normalizeActive(raw);

  if (JSON.stringify(raw) !== JSON.stringify(active)) {
    await setConfig(STORAGE_KEY, active);
  }

  return active;
}
