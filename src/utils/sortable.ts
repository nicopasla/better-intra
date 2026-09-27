import Sortable, { type SortableEvent } from "sortablejs";

export interface SortableListOptions {
  onReorder: (from: number, to: number) => void;
  handle?: string;
  filter?: string;
  draggable?: string;
  direction?: "horizontal" | "vertical";
}

function isDraggableItem(el: Element, selector?: string): boolean {
  if (!selector) return true;
  const normalized = selector.startsWith(">") ? selector.slice(1) : selector;
  try {
    return el.matches(normalized);
  } catch {
    return false;
  }
}

export function createSortable(
  container: HTMLElement,
  options: SortableListOptions,
): Sortable {
  return Sortable.create(container, {
    animation: 150,
    forceFallback: true,
    ghostClass: "ft-sortable-ghost",
    chosenClass: "ft-sortable-chosen",
    dragClass: "ft-sortable-drag",
    fallbackClass: "ft-sortable-fallback",
    handle: options.handle,
    filter: options.filter,
    draggable: options.draggable,
    direction: options.direction,
    onEnd: (evt: SortableEvent) => {
      const item = evt.item as HTMLElement | undefined;
      if (!item) return;
      const parent = item.parentElement;
      if (!parent) return;
      const draggableChildren = Array.from(parent.children).filter((child) =>
        isDraggableItem(child, options.draggable),
      );
      const from = evt.oldDraggableIndex ?? evt.oldIndex;
      const to = draggableChildren.indexOf(item);
      if (from == null || to < 0 || from === to) return;
      options.onReorder(from, to);
    },
  });
}

export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export function mergeVisibleOrder(
  order: readonly string[],
  visible: readonly string[],
): string[] {
  let i = 0;
  return order.map((name) => (name.startsWith("-") ? name : visible[i++]));
}
