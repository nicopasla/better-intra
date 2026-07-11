import { getConfig } from "../config.ts";

export async function openLinksInNewTab(): Promise<boolean> {
  return await getConfig("ADVANCED_OPEN_LINKS_NEW_TAB");
}

export function newTabAttrs(targetBlank: boolean): string {
  return targetBlank ? 'target="_blank" rel="noopener noreferrer"' : "";
}
