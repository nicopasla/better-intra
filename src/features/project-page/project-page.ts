import { render } from "lit-html";
import { getConfig } from "../../config.ts";
import { adoptShadowCss } from "../../utils/shadow-styles.ts";
import { ensureDocumentStyle } from "../../utils/style.ts";
import { waitFor } from "../../utils/wait-for.ts";
import { resolveDaisyTheme } from "../profile/theme/theme-manager.ts";
import {
  subjectBadgeInfo,
  type LocalSubjectState,
  type SubjectBadgeInfo,
} from "../subjects/badge.ts";
import {
  collectProjectInfo,
  currentSlug,
  deriveStats,
  fetchProjectStats,
  resolveUserCampusName,
} from "./data.ts";
import { activePieData, projectPageTemplate, type StatsTab } from "./render.ts";
import {
  destroyPieChart,
  mountPieChart,
  resolveCssColor,
} from "./pie-chart.ts";
import PROJECT_PAGE_CSS from "./project-page.css?inline";

const HOST_ID = "ft-project-page-host";

let started = false;

async function readSubjectBadge(
  slug: string,
): Promise<SubjectBadgeInfo | null> {
  if (!(await getConfig("SUBJECT_TRACKER_ENABLED"))) return null;
  const state = await getConfig("SUBJECT_TRACKER_STATE");
  return subjectBadgeInfo(state?.[slug] as LocalSubjectState | undefined);
}

export async function initProjectPage(): Promise<void> {
  if (started) return;
  started = true;
  if (location.hostname !== "projects.intra.42.fr") return;
  if (!currentSlug()) return;
  if (!(await getConfig("PROJECT_PAGE_REDESIGN"))) return;

  const ready = await waitFor(
    () => document.querySelector(".project-main") !== null,
    8000,
  );
  if (!ready) return;

  const header = document.querySelector<HTMLElement>(".project-header");
  const main = document.querySelector<HTMLElement>(".project-main");
  if (!main) return;

  let info = collectProjectInfo();
  const [stats, campusName] = await Promise.all([
    fetchProjectStats(info.slug),
    resolveUserCampusName(),
  ]);
  const derived = deriveStats(stats);

  const hideNative = (): void => {
    header?.style.setProperty("display", "none");
    document.querySelectorAll<HTMLElement>(".project-header").forEach((el) => {
      el.style.setProperty("display", "none");
    });
    // Keep .project-main itself (it's the page's scroll container), hide its
    // native content so the 42 header/sidebar keep their layout and stickiness.
    document.querySelectorAll<HTMLElement>(".project-main").forEach((m) => {
      for (const child of Array.from(m.children)) {
        if (child.id === HOST_ID) continue;
        (child as HTMLElement).style.setProperty("display", "none");
      }
    });
  };
  hideNative();

  // The redesign's content makes the window scroll, which would carry the
  // (position: relative) 42 navbar away. Pin it and offset the content.
  const navbar = document.querySelector<HTMLElement>(".main-navbar");
  if (navbar) {
    const navH = Math.round(navbar.getBoundingClientRect().height) || 60;
    ensureDocumentStyle(
      "ft-project-page-navbar",
      `.main-navbar{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:1030!important;}` +
        `body{padding-top:${navH}px!important;}`,
    );
  }

  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  adoptShadowCss(shadow, PROJECT_PAGE_CSS);

  const mount = document.createElement("div");
  shadow.appendChild(mount);

  main.appendChild(host);

  let theme = await resolveDaisyTheme();
  let subject = await readSubjectBadge(info.slug);
  let activeTab: StatsTab = "outcomes";
  const animate = !(await getConfig("DISABLE_ANIMATIONS"));

  const draw = (): void => {
    destroyPieChart();
    render(
      projectPageTemplate(
        info,
        derived,
        subject,
        campusName,
        activeTab,
        (tab) => {
          activeTab = tab;
          draw();
        },
        theme,
      ),
      mount,
    );
    const canvas = shadow.querySelector<HTMLCanvasElement>(
      "canvas.ft-pp-pie-canvas",
    );
    if (!canvas) return;
    const data = activePieData(derived, campusName, activeTab);
    if (data.length === 0) return;
    const styleEl = shadow.querySelector<HTMLElement>(".ft-pp") ?? shadow.host;
    const slices = data.map((d) => ({
      label: d.label,
      value: d.value,
      tooltip: d.tooltip,
    }));
    const colors = data.map((d) => resolveCssColor(styleEl, d.colorVar));
    void mountPieChart(canvas, slices, colors, animate);
  };
  draw();

  // The registrations block (counts + can_register link) is often filled in
  // after load; re-collect and redraw once it has content.
  let refreshTimer: number | null = null;
  const scheduleRefresh = (): void => {
    if (refreshTimer !== null) return;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      const next = collectProjectInfo();
      if (JSON.stringify(next) === JSON.stringify(info)) return;
      info = next;
      draw();
    }, 200);
  };

  const statsBlock = document.querySelector<HTMLElement>(
    "#projects_registrations_stats",
  );
  if (statsBlock) {
    new MutationObserver(() => scheduleRefresh()).observe(statsBlock, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
  void waitFor(
    () =>
      !!(
        document.querySelector<HTMLElement>("#projects_registrations_stats")
          ?.innerText ?? ""
      ).trim(),
    5000,
  ).then((ok) => {
    if (ok) scheduleRefresh();
  });

  const refreshTheme = (): void => {
    void resolveDaisyTheme().then((next) => {
      if (next === theme) return;
      theme = next;
      draw();
    });
  };

  new MutationObserver(refreshTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.PROFILE_THEME_PRESET || changes.PROFILE_THEME_CUSTOMS) {
      refreshTheme();
    }
    if (!changes.SUBJECT_TRACKER_STATE) return;
    void readSubjectBadge(info.slug).then((next) => {
      subject = next;
      draw();
    });
  });

  // If intra re-renders the native content, keep it hidden. Bounded: an endless
  // whole-body observer scanned the page on every unrelated DOM change.
  const keepNativeHidden = new MutationObserver(() => {
    const mainEl = document.querySelector<HTMLElement>(".project-main");
    if (!mainEl) return;
    const visible = Array.from(mainEl.children).some(
      (c) => c.id !== HOST_ID && (c as HTMLElement).style.display !== "none",
    );
    if (visible) hideNative();
  });
  keepNativeHidden.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => keepNativeHidden.disconnect(), 25_000);
  window.addEventListener(
    "pagehide",
    () => keepNativeHidden.disconnect(),
    { once: true },
  );
}
