import { html, svg } from "lit-html";
import type { TemplateResult } from "lit-html";
import {
  findCampus,
  groupFlags,
  groupMarks,
  type DerivedStats,
  type FlagStat,
  type ProjectInfo,
} from "./data.ts";
import type { SubjectBadgeInfo } from "../subjects/badge.ts";

const STATUS_CLASS: Record<string, string> = {
  success: "badge-success",
  finished: "badge-success",
  fail: "badge-error",
  failed: "badge-error",
  in_progress: "badge-warning",
  waiting: "badge-warning",
};

const fmt = (n: number): string => n.toLocaleString("en-US");

export const PIE_COLORS = [
  "var(--color-primary, #00babc)",
  "var(--color-secondary, #d946ef)",
  "var(--color-accent, #f97316)",
  "var(--color-info, #3b82f6)",
  "var(--color-success, #22c55e)",
  "var(--color-warning, #f59e0b)",
  "var(--color-error, #ef4444)",
  "#8b5cf6",
  "#14b8a6",
];

export const OTHER_COLOR = "var(--color-neutral, #94a3b8)";

export function flagColor(name: string, all: FlagStat[]): string {
  const i = all.findIndex((f) => f.name === name);
  return i >= 0 ? PIE_COLORS[i % PIE_COLORS.length] : OTHER_COLOR;
}

export function markColor(
  mark: number | "Other",
  all: { mark: number }[],
): string {
  const i = all.findIndex((m) => m.mark === mark);
  return i >= 0 ? PIE_COLORS[i % PIE_COLORS.length] : OTHER_COLOR;
}

export interface PieDatum {
  label: string;
  value: number;
  tooltip: string;
  colorVar: string;
}

export function activePieData(
  d: DerivedStats,
  campusName: string | null,
  tab: StatsTab,
): PieDatum[] {
  if (tab === "flags") {
    return groupFlags(d.flags).map((f) => ({
      label: f.name,
      value: f.pct,
      tooltip: `${f.name}: ${fmt(f.count)} · ${f.pct.toFixed(1)}%`,
      colorVar: flagColor(f.name, d.flags),
    }));
  }
  if (tab === "marks") {
    const campus = findCampus(d, campusName);
    if (!campus) return [];
    return groupMarks(campus.marks).map((m) => ({
      label: String(m.mark),
      value: m.pct,
      tooltip:
        m.mark === "Other"
          ? `Other: ${m.pct.toFixed(1)}%`
          : `Mark ${m.mark}: ${m.pct.toFixed(1)}%`,
      colorVar: markColor(m.mark, campus.marks),
    }));
  }
  return [];
}

function statusChip(info: ProjectInfo): TemplateResult | string {
  if (!info.status) return "";
  // The native page reports an unstarted project as `fail · 0`; don't show that.
  if (
    info.status === "fail" &&
    (!info.statusCount || info.statusCount === "0")
  ) {
    return "";
  }
  const cls = STATUS_CLASS[info.status] ?? "badge-ghost";
  const label = info.status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const count =
    info.statusCount && info.statusCount !== "0"
      ? ` · ${info.statusCount}`
      : "";
  return html`<span
    class="badge ${cls} ft-pp-status font-semibold whitespace-nowrap"
    >${label}${count}</span
  >`;
}

function subjectBadge(
  subject: SubjectBadgeInfo | null,
): TemplateResult | string {
  if (!subject) return "";
  const tone =
    subject.tone === "error"
      ? "text-error"
      : subject.tone === "warning"
        ? "text-warning"
        : "";
  return stat("Subject updated", subject.when, undefined, tone);
}

function header(
  info: ProjectInfo,
  subject: SubjectBadgeInfo | null,
): TemplateResult {
  return html`
    <div class="card bg-base-100 shadow-xl mb-4">
      <div class="card-body gap-3">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <h1 class="text-3xl font-extrabold leading-tight">${info.name}</h1>
          ${statusChip(info)}
        </div>
        <div class="ft-pp-meta">
          ${info.kind ? stat("Type", info.kind, undefined, "text-primary") : ""}
          ${info.hours != null
            ? stat("Duration", `~${fmt(info.hours)}h`, undefined, "text-info")
            : ""}
          ${info.xp != null
            ? stat("XP", fmt(info.xp), undefined, "text-secondary")
            : ""}
          ${subjectBadge(subject)}
          ${info.myPageHref
            ? html`<a class="ft-pp-stat ft-pp-stat-link" href=${info.myPageHref}
                >My project</a
              >`
            : ""}
        </div>
      </div>
    </div>
  `;
}

const FILE_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;

const DOWNLOAD_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;

function filesCard(
  attachments: ProjectInfo["attachments"],
): TemplateResult | string {
  if (attachments.length === 0) return "";
  return html`
    <div class="card bg-base-100 shadow-xl h-full">
      <div class="card-body gap-3">
        <h2 class="card-title text-base">Files</h2>
        <div class="ft-pp-files">
          ${attachments.map(
            (a) =>
              html`<a
                class="ft-pp-file"
                href=${a.href}
                target=${a.external ? "_blank" : "_self"}
                rel="noopener noreferrer"
              >
                <span class="ft-pp-file-icon">${FILE_ICON}</span>
                <span class="ft-pp-file-name">${a.name}</span>
                <span
                  class="ft-pp-file-download"
                  title="Download"
                  aria-hidden="true"
                  >${DOWNLOAD_ICON}</span
                >
              </a>`,
          )}
        </div>
      </div>
    </div>
  `;
}

function stat(
  label: string,
  value: string,
  sub?: string,
  tone = "",
): TemplateResult {
  return html`<div class="ft-pp-stat">
    <div class="ft-pp-stat-label">${label}</div>
    <div class="ft-pp-stat-value-line">
      <span class="ft-pp-stat-value ${tone}">${value}</span>
      ${sub ? html`<span class="ft-pp-stat-sub">${sub}</span>` : ""}
    </div>
  </div>`;
}

function outcomeBar(d: DerivedStats): TemplateResult | string {
  if (!d.success || !d.fail || !d.noGrade) return "";
  const seg = (p: number, cls: string) =>
    p > 0
      ? html`<span
          class="ft-pp-outcome-seg ${cls}"
          style="width:${p.toFixed(2)}%"
        ></span>`
      : "";
  return html`<div class="ft-pp-outcome-bar">
    ${seg(d.success.pct, "is-success")} ${seg(d.fail.pct, "is-fail")}
    ${seg(d.noGrade.pct, "is-none")}
  </div>`;
}

function pieChart(
  items: { name: string; colorVar: string; value: string }[],
): TemplateResult {
  return html`
    <div class="ft-pp-pie">
      <div class="ft-pp-pie-canvas-wrap">
        <canvas class="ft-pp-pie-canvas"></canvas>
      </div>
      <ul class="ft-pp-pie-legend">
        ${items.map(
          (it) =>
            html`<li>
              <span
                class="ft-pp-pie-dot"
                style="background:${it.colorVar}"
              ></span>
              <span class="ft-pp-pie-name" title=${it.name}>${it.name}</span>
              <span class="ft-pp-pie-val tabular-nums">${it.value}</span>
            </li>`,
        )}
      </ul>
    </div>
  `;
}

export type StatsTab = "outcomes" | "lifespan" | "flags" | "marks";

interface StatsTabDef {
  id: StatsTab;
  label: string;
  content: TemplateResult;
}

export function participationCard(info: ProjectInfo): TemplateResult | string {
  const c = info.counts;
  const cards: TemplateResult[] = [];
  if (c.attempts != null) cards.push(stat("Attempts", fmt(c.attempts)));
  if (c.distinctStudents != null)
    cards.push(stat("Students", fmt(c.distinctStudents), "distinct"));
  if (c.finished != null)
    cards.push(
      stat(
        "Finished",
        fmt(c.finished),
        c.retries ? `${fmt(c.retries)} retries` : undefined,
        "text-success",
      ),
    );
  if (c.currentlyDoing != null)
    cards.push(
      stat("In progress", fmt(c.currentlyDoing), "doing it now", "text-info"),
    );
  if (c.waitingEval != null)
    cards.push(
      stat("Waiting eval", fmt(c.waitingEval), "teams", "text-warning"),
    );
  if (cards.length === 0 && !info.canRegisterHref) return "";

  return html`
    <div class="card bg-base-100 shadow-xl h-full">
      <div class="card-body gap-3">
        <h2 class="card-title text-base">Participation</h2>
        <div class="ft-pp-stats">
          ${cards}
          ${info.canRegisterHref
            ? html`<a
                class="ft-pp-stat ft-pp-stat-link"
                href=${info.canRegisterHref}
                >Students who can subscribe</a
              >`
            : ""}
        </div>
      </div>
    </div>
  `;
}

function statsSection(
  d: DerivedStats,
  campusName: string | null,
  activeTab: StatsTab,
  onTab: (tab: StatsTab) => void,
): TemplateResult | string {
  const tabs: StatsTabDef[] = [];

  const outcomes: TemplateResult[] = [];
  if (d.totalTeams != null) outcomes.push(stat("Teams", fmt(d.totalTeams)));
  if (d.success)
    outcomes.push(
      stat(
        "Success",
        fmt(d.success.count),
        `${d.success.pct.toFixed(0)}%`,
        "text-success",
      ),
    );
  if (d.fail)
    outcomes.push(
      stat(
        "Failed",
        fmt(d.fail.count),
        `${d.fail.pct.toFixed(0)}%`,
        "text-error",
      ),
    );
  if (d.noGrade)
    outcomes.push(
      stat(
        "No grade yet",
        fmt(d.noGrade.count),
        `${d.noGrade.pct.toFixed(0)}%`,
      ),
    );
  if (outcomes.length) {
    tabs.push({
      id: "outcomes",
      label: "Outcomes",
      content: html`<div class="ft-pp-subhead">All campuses</div>
        <div class="ft-pp-stats">${outcomes}</div>
        ${outcomeBar(d)}`,
    });
  }

  const lifespan: TemplateResult[] = [];
  if (d.lifespanSuccess != null)
    lifespan.push(
      stat(
        "Success",
        `${Math.round(d.lifespanSuccess)}d`,
        undefined,
        "text-success",
      ),
    );
  if (d.lifespanFail != null)
    lifespan.push(
      stat("Fail", `${Math.round(d.lifespanFail)}d`, undefined, "text-error"),
    );
  if (d.lifespanNone != null)
    lifespan.push(stat("No grade yet", `${Math.round(d.lifespanNone)}d`));
  if (lifespan.length) {
    tabs.push({
      id: "lifespan",
      label: "Lifespan",
      content: html`<div class="ft-pp-subhead">
          Average days (team lock → close)
        </div>
        <div class="ft-pp-stats">${lifespan}</div>`,
    });
  }

  if (d.flags.length) {
    tabs.push({
      id: "flags",
      label: "Flags",
      content: pieChart(
        d.flags.map((f) => ({
          name: f.name,
          colorVar: flagColor(f.name, d.flags),
          value: `${fmt(f.count)} · ${f.pct.toFixed(1)}%`,
        })),
      ),
    });
  }

  const campus = findCampus(d, campusName);
  if (campus && campus.marks.length) {
    tabs.push({
      id: "marks",
      label: "Marks",
      content: html`<div class="ft-pp-subhead">${campus.name}</div>
        ${pieChart(
          campus.marks.map((m) => ({
            name: String(m.mark),
            colorVar: markColor(m.mark, campus.marks),
            value: `${m.pct.toFixed(1)}%`,
          })),
        )}`,
    });
  }

  if (tabs.length === 0) return "";
  const active = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id;
  const current = tabs.find((t) => t.id === active)!;

  return html`
    <div class="card bg-base-100 shadow-xl mb-4">
      <div class="card-body gap-3">
        <h2 class="card-title text-base">Stats</h2>
        <div class="ft-pp-tabbar">
          ${tabs.map(
            (t) =>
              html`<button
                type="button"
                class="ft-pp-tab ${active === t.id ? "is-active" : ""}"
                @click=${() => onTab(t.id)}
              >
                ${t.label}
              </button>`,
          )}
        </div>
        <div class="ft-pp-tab-content">${current.content}</div>
      </div>
    </div>
  `;
}

function descriptionCard(text: string): TemplateResult {
  return html`
    <div class="card bg-base-100 shadow-xl mb-4">
      <div class="card-body gap-2">
        <h2 class="card-title text-base">Description</h2>
        <p class="text-sm leading-relaxed whitespace-pre-line">${text}</p>
      </div>
    </div>
  `;
}

function skillsCard(skills: string[]): TemplateResult {
  return html`
    <div class="card bg-base-100 shadow-xl mb-4">
      <div class="card-body gap-2">
        <h2 class="card-title text-base">Skills</h2>
        <div class="flex flex-wrap gap-2">
          ${skills.map(
            (s) => html`<span class="badge badge-lg badge-outline">${s}</span>`,
          )}
        </div>
      </div>
    </div>
  `;
}

function topRow(info: ProjectInfo): TemplateResult | string {
  const files = filesCard(info.attachments);
  const participation = participationCard(info);
  if (files === "" && participation === "") return "";
  if (files === "" || participation === "")
    return html`<div class="mb-4">
      ${files === "" ? participation : files}
    </div>`;
  return html`
    <div class="ft-pp-top-grid mb-4">
      <div class="ft-pp-col-files">${files}</div>
      <div class="ft-pp-col-part">${participation}</div>
    </div>
  `;
}

export function projectPageTemplate(
  info: ProjectInfo,
  d: DerivedStats,
  subject: SubjectBadgeInfo | null,
  campusName: string | null,
  activeTab: StatsTab,
  onTab: (tab: StatsTab) => void,
  theme: string,
): TemplateResult {
  return html`
    <div class="ft-pp" data-theme=${theme}>
      ${header(info, subject)} ${topRow(info)}
      ${info.description ? descriptionCard(info.description) : ""}
      ${info.skills.length ? skillsCard(info.skills) : ""}
      ${statsSection(d, campusName, activeTab, onTab)}
    </div>
  `;
}
