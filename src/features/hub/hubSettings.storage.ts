import { gmSetValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";
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

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return FEATURE_DEFS.map((f) => f.id);
  }

  const ids = (parsed as string[]).filter((v): v is FeatureId =>
    FEATURE_IDS.has(v as FeatureId),
  );

  return ids.length ? ids : FEATURE_DEFS.map((f) => f.id);
}

export async function getActiveFeatures(): Promise<FeatureId[]> {
  const raw = await getConfig("ACTIVE_SCRIPTS");
  const active = normalizeActive(raw);

  await gmSetValue(STORAGE_KEY, JSON.stringify(active));

  return active;
}
