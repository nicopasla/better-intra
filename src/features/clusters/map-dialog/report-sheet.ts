import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { formatRelative } from "../../../utils/dates.ts";
import CHECK_SVG from "../../../assets/svg/check.svg?raw";
import X_SVG from "../../../assets/svg/x.svg?raw";
import type { DialogState } from "./context";
import { SEAT_COMPONENTS, SEAT_COMPONENT_MAP } from "./components";
import type { SeatComponentDef, SeatComponentKey } from "./components";
import { SEAT_COMPONENT_ICONS } from "./seat-icons";
import {
  getComponentStatus,
  getSeatReport,
  loadSeatHistory,
  submitSeatReports,
} from "./reports";
import type { SeatComponentStatus, SeatReportEvent } from "./reports";

const DIALOG_CLASS = "ft-seat-report-dialog";

export interface SeatReportSheetOptions {
  state: DialogState;
  seat: string;
  cluster: string;
  occupant: string | null;
  /** Called after a successful report so the map can redraw. */
  onChanged: () => void;
}

const icon = (raw: string, size = 12) =>
  unsafeHTML(raw.replace("<svg", `<svg width="${size}" height="${size}"`));

function componentCell(
  def: SeatComponentDef,
  status: SeatComponentStatus | undefined,
  disabled: boolean,
  onSelect: (component: SeatComponentKey, status: SeatComponentStatus) => void,
) {
  // Presence components answer "does this seat have it?" (USB-C) instead of
  // "is it working?", so they get explicit Yes/No buttons.
  if (def.kind === "presence") {
    const labels = def.labels ?? { on: "Yes", off: "No" };
    const yes = status === "works";
    const no = status === "broken";
    const button = (value: SeatComponentStatus, label: string, on: boolean) => {
      const tone = on
        ? value === "works"
          ? "btn-success"
          : "btn-neutral"
        : "btn-ghost";
      return html`<button
        type="button"
        class="btn btn-sm join-item h-10 min-h-0 flex-1 px-1 text-xs disabled:pointer-events-none disabled:opacity-50 ${tone}"
        aria-pressed=${on ? "true" : "false"}
        ?disabled=${disabled}
        @click=${() => onSelect(def.key, value)}
      >
        ${label}
      </button>`;
    };
    return html`<div
      class="flex flex-col items-center gap-1 rounded-lg bg-base-200/60 p-1"
    >
      <span class="text-center text-xs font-semibold leading-tight"
        >${def.label}</span
      >
      <div class="join seat-presence-toggle w-full">
        ${button("works", labels.on, yes)} ${button("broken", labels.off, no)}
      </div>
    </div>`;
  }

  const icons = SEAT_COMPONENT_ICONS[def.key];
  const broken = status === "broken";
  const next: SeatComponentStatus = broken
    ? "works"
    : status === "works"
      ? "broken"
      : "works";
  const tone = broken
    ? "badge-error"
    : status === "works"
      ? "badge-success"
      : "badge-ghost";
  const hint = broken
    ? `${def.label}: broken — tap to mark working`
    : status === "works"
      ? `${def.label}: working — tap to mark broken`
      : `${def.label}: not reported — tap to mark working`;
  return html`<div
    class="flex flex-col items-center gap-1 rounded-lg bg-base-200/60 p-1"
  >
    <span class="text-center text-xs font-semibold leading-tight"
      >${def.label}</span
    >
    <button
      type="button"
      class="badge badge-lg h-10 w-full rounded-lg p-0 disabled:pointer-events-none disabled:opacity-50 ${tone}"
      title=${hint}
      aria-label=${hint}
      ?disabled=${disabled}
      @click=${() => onSelect(def.key, next)}
    >
      ${icon(broken ? icons.off : icons.on, 24)}
    </button>
  </div>`;
}

/** Opens the component-status sheet for a cluster seat. */
export function openSeatReportSheet(options: SeatReportSheetOptions): void {
  const { state, seat, cluster, occupant, onChanged } = options;
  const host =
    state.shadow.querySelector<HTMLElement>("[data-theme]") ?? state.shadow;
  host
    .querySelectorAll<HTMLDialogElement>(`dialog.${DIALOG_CLASS}`)
    .forEach((el) => el.remove());

  const dialog = document.createElement("dialog");
  dialog.className = `${DIALOG_CLASS} bg-transparent backdrop:bg-black/50`;
  dialog.style.cssText =
    "margin:auto;padding:0;border:none;outline:none;max-width:28rem;width:calc(100dvw - 2rem);";

  let draft = new Map<SeatComponentKey, SeatComponentStatus>();
  let saving = false;
  let error = "";
  let history: SeatReportEvent[] | null = null;
  let historyError = "";
  let historyToken = 0;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    dialog.close();
    dialog.remove();
  };

  const currentStatus = (component: SeatComponentKey) =>
    getComponentStatus(seat, component)?.status;

  const effectiveStatus = (component: SeatComponentKey) => {
    const explicit = draft.get(component) ?? currentStatus(component);
    if (explicit) return explicit;
    // Everything is assumed working unless a component opts out (USB-C).
    return SEAT_COMPONENT_MAP.get(component)?.assumeWorking === false
      ? undefined
      : "works";
  };

  const loadHistory = async () => {
    const token = ++historyToken;
    try {
      const events = await loadSeatHistory(seat);
      if (token !== historyToken) return;
      history = events;
      historyError = "";
    } catch {
      if (token !== historyToken) return;
      historyError = "Couldn't load the history.";
    }
    draw();
  };

  const select = (component: SeatComponentKey, status: SeatComponentStatus) => {
    if (saving) return;
    if (
      effectiveStatus(component) === status ||
      currentStatus(component) === status
    ) {
      draft.delete(component);
    } else {
      draft.set(component, status);
    }
    // No computer means none of the other parts can be assessed: drop their
    // pending answers so a batch never mixes "no computer" with "keyboard
    // broken".
    if (component === "computer" && effectiveStatus("computer") === "broken") {
      for (const key of [...draft.keys()]) {
        if (key !== "computer") draft.delete(key);
      }
    }
    error = "";
    draw();
  };

  const submitEntries = async (
    entries: { component: SeatComponentKey; status: SeatComponentStatus }[],
  ) => {
    saving = true;
    error = "";
    draw();
    try {
      await submitSeatReports(seat, cluster, entries);
      draft.clear();
      onChanged();
      void loadHistory();
    } catch (e) {
      error =
        e instanceof Error && e.message === "not_connected"
          ? "Connect Better Intra cloud to report issues."
          : "Couldn't save the report. Try again.";
    } finally {
      saving = false;
      draw();
    }
  };

  const save = async () => {
    if (saving || draft.size === 0) return;
    await submitEntries(
      [...draft].map(([component, status]) => ({ component, status })),
    );
  };

  /** Confirms the whole seat as working in one go. */
  const onEverythingWorks = async () => {
    if (saving) return;
    draft.clear();
    // Presence components (USB-C) are not implied by "everything works".
    await submitEntries(
      SEAT_COMPONENTS.filter((component) => component.kind !== "presence").map(
        (component) => ({
          component: component.key,
          status: "works" as const,
        }),
      ),
    );
  };

  /** First visit on an unreported seat: record the default working baseline. */
  const seedWorking = async () => {
    try {
      await submitSeatReports(
        seat,
        cluster,
        SEAT_COMPONENTS.filter(
          (component) => component.assumeWorking !== false,
        ).map((component) => ({
          component: component.key,
          status: "works" as const,
        })),
      );
      onChanged();
      void loadHistory();
    } catch {
      /* the next open retries */
    }
  };

  const historyList = () => {
    if (history === null) {
      return html`<div class="flex justify-center py-2">
        <span class="loading loading-spinner loading-xs"></span>
      </div>`;
    }
    if (historyError) {
      return html`<p class="text-xs text-error">${historyError}</p>`;
    }
    const rows = history
      .filter((event) => SEAT_COMPONENT_MAP.has(event.component))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30);
    if (rows.length === 0) {
      return html`<p class="text-xs opacity-60">No changes reported yet.</p>`;
    }
    return html`<div class="flex flex-col gap-1.5">
      ${rows.map((event) => {
        const def = SEAT_COMPONENT_MAP.get(event.component)!;
        const icons = SEAT_COMPONENT_ICONS[event.component];
        const works = event.status === "works";
        const presence = def.kind === "presence";
        const onLabel = def.labels?.on ?? "Working";
        const offLabel = def.labels?.off ?? "Broken";
        const tone = works
          ? "badge-success"
          : presence
            ? "badge-neutral"
            : "badge-error";
        return html`<div
          class="flex items-center justify-between gap-2 rounded-lg bg-base-200/60 px-2 py-1.5"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <span
              class="flex size-4 shrink-0 items-center justify-center opacity-70"
              >${icon(works ? icons.on : icons.off, 14)}</span
            >
            <span class="flex min-w-0 flex-col">
              <span class="truncate text-xs font-medium">${def.label}</span>
              <span class="truncate text-[10px] opacity-60"
                >${event.reporter
                  ? `by ${event.reporter} · `
                  : ""}${formatRelative(event.createdAt)}</span
              >
            </span>
          </span>
          <span class="badge badge-sm shrink-0 ${tone}"
            >${works ? onLabel : offLabel}</span
          >
        </div>`;
      })}
    </div>`;
  };

  const body = () => {
    // A seat with no computer has nothing else to report: grey out the rest.
    const noComputer = effectiveStatus("computer") === "broken";
    return html`
      ${occupant
        ? html`<div
            class="alert alert-info flex justify-center rounded-[var(--badge-radius)] py-2 text-center text-xs"
          >
            <span>In use by <strong>${occupant}</strong> right now.</span>
          </div>`
        : ""}
      <div class="grid grid-cols-3 gap-1.5">
        ${SEAT_COMPONENTS.map((def) =>
          componentCell(
            def,
            effectiveStatus(def.key),
            saving || (noComputer && def.key !== "computer"),
            select,
          ),
        )}
      </div>
      ${noComputer
        ? html`<p class="text-center text-xs opacity-60">
            No computer at this seat — only the computer presence can be
            changed.
          </p>`
        : ""}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="badge badge-lg badge-success gap-1 px-3 font-semibold disabled:pointer-events-none disabled:opacity-50"
          ?disabled=${saving || noComputer}
          @click=${onEverythingWorks}
        >
          ${icon(CHECK_SVG, 12)} Everything works
        </button>
        <button
          type="button"
          class="btn btn-sm btn-primary flex-1"
          ?disabled=${saving || draft.size === 0}
          @click=${save}
        >
          ${saving
            ? html`<span class="loading loading-spinner loading-xs"></span>`
            : `Save changes${draft.size ? ` (${draft.size})` : ""}`}
        </button>
      </div>
      ${error ? html`<p class="text-xs text-error">${error}</p>` : ""}
      <details class="collapse collapse-arrow rounded-box bg-base-200/60">
        <summary class="collapse-title text-sm font-medium">History</summary>
        <div class="collapse-content">${historyList()}</div>
      </details>
      <p class="text-center text-xs opacity-60">
        Your login is attached to every report.
      </p>
    `;
  };

  const draw = () => {
    render(
      html`<div
        class="bg-base-100 text-base-content flex max-h-[85vh] flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3"
        >
          <div class="min-w-0">
            <div class="truncate font-bold">${seat.toUpperCase()}</div>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm shrink-0"
            aria-label="Close"
            @click=${close}
          >
            ${unsafeHTML(X_SVG.replace("<svg", '<svg width="18" height="18"'))}
          </button>
        </div>
        <div
          class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          ${body()}
        </div>
      </div>`,
      dialog,
    );
  };

  dialog.addEventListener("click", (ev) => {
    if (ev.target === dialog) close();
  });
  dialog.addEventListener("close", () => {
    if (!closed) {
      closed = true;
      dialog.remove();
    }
  });

  host.appendChild(dialog);
  dialog.showModal();
  draw();
  void loadHistory();
  // Unreported seat: store the "everything works" baseline on first open.
  if (!getSeatReport(seat)?.components.length) void seedWorking();
}
