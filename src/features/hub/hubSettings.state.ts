export type PanelBuilder = () => unknown;

export let dynamicCampusOptions: { label: string; value: string }[] = [];
export let dynamicEventTypeOptions: { label: string; value: string }[] = [];

export function setDynamicCampusOptions(
  options: { label: string; value: string }[],
): void {
  dynamicCampusOptions = options;
}

export function setDynamicEventTypeOptions(
  options: { label: string; value: string }[],
): void {
  dynamicEventTypeOptions = options;
}

export const panelBuilders = new Map<string, PanelBuilder>();

export interface HubTabsState {
  wired: WeakSet<Element>;
  overflowing: boolean;
  resizeObserver: ResizeObserver | null;
}

export const hubTabsState: HubTabsState = {
  wired: new WeakSet(),
  overflowing: false,
  resizeObserver: null,
};
