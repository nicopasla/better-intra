import { render } from "lit-html";
import { getConfig } from "../../../config.ts";
import { clearAuthFailed, loginWith42 } from "../../account/account.ts";
import {
  TOOLTIP_SHOW_DELAY,
  hideFloatingTooltip,
  showFloatingTooltip,
} from "../../../utils/tooltip.ts";
import { makeResizable } from "../../../utils/resizable-dialog.ts";
import { adoptShadowStyles } from "../../../utils/shadow-styles.ts";
import { getEffectiveTheme } from "../theme/theme-manager.ts";
import {
  INITIAL_VISIBLE_COUNT,
  WINDOW_STEP,
  fetchPiscines,
  fetchPisciners,
  fetchStudentsPage,
  fetchFutureStudents,
  poolIntakes,
  sortEntries,
} from "./data.ts";
import {
  STUDENTS_TAB_LABELS,
  renderStudentsDialogTemplate,
  StudentsTemplateHandlers,
  StudentsTemplateState,
} from "./template.ts";
import type {
  FilterKey,
  PiscineEntry,
  SortField,
  SortDir,
  StudentEntry,
  StudentsFilter,
  StudentsFilterOptions,
  StudentsTab,
  StudentsView,
} from "./data.ts";

let studentsOpening: Promise<void> | null = null;

const TABS_OVERFLOW_TOLERANCE = 1;

/**
 * Measure whether the inline tab strip would overflow its host. Uses an
 * absolutely-positioned probe so it never affects the host's flex width and
 * therefore cannot feed back into the ResizeObserver.
 */
function measureTabsOverflow(host: HTMLElement): boolean {
  if (host.clientWidth === 0) return false;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;top:0;left:-9999px;visibility:hidden;display:flex;gap:4px;padding:4px;width:max-content;white-space:nowrap;";
  for (const label of Object.values(STUDENTS_TAB_LABELS)) {
    const item = document.createElement("span");
    item.className = "tab-btn";
    item.style.cssText = "flex:0 0 auto;white-space:nowrap;";
    item.textContent = label;
    probe.appendChild(item);
  }
  host.appendChild(probe);
  const overflows =
    probe.scrollWidth - host.clientWidth > TABS_OVERFLOW_TOLERANCE;
  probe.remove();
  return overflows;
}

export function openStudentsDialog(): Promise<void> {
  if (document.getElementById("students-dialog")) return Promise.resolve();
  if (studentsOpening) return studentsOpening;
  studentsOpening = openStudentsDialogImpl().finally(() => {
    studentsOpening = null;
  });
  return studentsOpening;
}

async function openStudentsDialogImpl() {
  const campusId = await getConfig("CLUSTERS_CAMPUS");
  if (campusId !== "12") return;
  if (document.getElementById("students-dialog")) return;

  const now = new Date();
  const currentYear = now.getFullYear();

  const presetKey = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
  const effectiveTheme = await getEffectiveTheme();
  const currentTheme =
    presetKey !== "dark" && presetKey !== "light" ? presetKey : effectiveTheme;
  const isLight = effectiveTheme === "light";

  let tab: StudentsTab = "students";
  let view: StudentsView = "grid";
  let sortField: SortField = "name";
  let nameDir: SortDir = "asc";
  let dateDir: SortDir = "desc";
  let filter: StudentsFilter = "none";
  let poolIntake: { month: number; year: number } | null = null;
  let poolYear: number | null = null;
  let selectedPiscine: { year: number; month: number } | null = null;

  const toggleFilter = (key: FilterKey) => {
    filter = filter === key ? "none" : key;
    visibleCount = INITIAL_VISIBLE_COUNT;
    if (tab === "students") {
      void loadStudentsPage(true);
      return;
    }
    rerender();
  };

  const savedView = (await chrome.storage.local.get("STUDENTS_VIEW")) as {
    STUDENTS_VIEW?: "grid" | "list";
  };
  if (
    savedView.STUDENTS_VIEW === "grid" ||
    savedView.STUDENTS_VIEW === "list"
  ) {
    view = savedView.STUDENTS_VIEW;
  }

  const setView = (v: StudentsView) => {
    if (view === v) return;
    view = v;
    chrome.storage.local.set({ STUDENTS_VIEW: view });
    rerender();
  };

  const savedSort = (await chrome.storage.local.get("STUDENTS_SORT")) as {
    STUDENTS_SORT?: { field?: SortField; nameDir?: SortDir; dateDir?: SortDir };
  };
  const savedSortData = savedSort.STUDENTS_SORT;
  if (savedSortData) {
    if (savedSortData.field === "name" || savedSortData.field === "date")
      sortField = savedSortData.field;
    if (savedSortData.nameDir === "asc" || savedSortData.nameDir === "desc")
      nameDir = savedSortData.nameDir;
    if (savedSortData.dateDir === "asc" || savedSortData.dateDir === "desc")
      dateDir = savedSortData.dateDir;
  }

  const persistSort = () => {
    chrome.storage.local.set({
      STUDENTS_SORT: { field: sortField, nameDir, dateDir },
    });
  };

  const setSort = (field: SortField) => {
    if (sortField === field) {
      if (field === "name") nameDir = nameDir === "asc" ? "desc" : "asc";
      else dateDir = dateDir === "desc" ? "asc" : "desc";
    } else {
      sortField = field;
    }
    persistSort();
    if (tab === "students") {
      void loadStudentsPage(true);
      return;
    }
    entries = sortEntries(entries, tab, sortField, nameDir, dateDir);
    rerender();
  };

  let entries: StudentEntry[] = [];
  let piscineList: PiscineEntry[] = [];
  let piscineListLoading = false;
  let piscineListLoaded = false;
  let loading = true;
  let loadingMore = false;
  let lastFetched = 0;
  let query = "";
  let authError = false;
  let visibleCount = INITIAL_VISIBLE_COUNT;
  let baseTotal = 0;
  let filteredTotal = 0;
  let activeCount = 0;
  let filterOptions: StudentsFilterOptions | null = null;
  let searchTimeout: number | null = null;
  let copiedLogin: string | null = null;
  let copiedLoginTimeout: number | null = null;
  let sentinelObserver: IntersectionObserver | null = null;
  let isMaximized = false;
  let tabsOverflowing = false;
  let tabsResizeObserver: ResizeObserver | null = null;

  const dialog = Object.assign(document.createElement("dialog"), {
    id: "students-dialog",
    className: "bg-transparent backdrop:bg-black/60",
  });
  Object.assign(dialog.style, {
    margin: "auto",
    width: "min(900px, calc(100dvw - 2rem))",
    height: "min(800px, calc(100dvh - 2rem))",
    borderRadius: "1rem",
    overflow: "hidden",
    padding: "0",
    border: "none",
    background: "transparent",
  });

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex;flex-direction:column;height:100%;overflow:hidden;";
  dialog.appendChild(wrapper);

  const shadow = wrapper.attachShadow({ mode: "closed" });

  const cleanupResize = makeResizable(dialog, {
    minWidth: 480,
    minHeight: 360,
    onResizeStart: () => {
      if (isMaximized) {
        isMaximized = false;
        dialog.style.margin = "auto";
        rerender();
      }
    },
  });

  const close = () => {
    hideFloatingTooltip();
    if (tooltipShowTimer !== null) window.clearTimeout(tooltipShowTimer);
    if (sentinelObserver) {
      sentinelObserver.disconnect();
      sentinelObserver = null;
    }
    if (tabsResizeObserver) {
      tabsResizeObserver.disconnect();
      tabsResizeObserver = null;
    }
    if (searchTimeout !== null) window.clearTimeout(searchTimeout);
    if (copiedLoginTimeout !== null) window.clearTimeout(copiedLoginTimeout);
    cleanupResize();
    dialog.close();
    dialog.remove();
  };

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  let tooltipShowTimer: number | null = null;

  shadow.addEventListener("mouseover", (e) => {
    const tipTarget = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-tip]",
    );
    if (!tipTarget?.dataset.tip) return;
    const tipText = tipTarget.dataset.tip;
    if (tooltipShowTimer !== null) window.clearTimeout(tooltipShowTimer);
    tooltipShowTimer = window.setTimeout(() => {
      tooltipShowTimer = null;
      showFloatingTooltip(tipTarget, tipText, isLight, dialog);
    }, TOOLTIP_SHOW_DELAY);
  });
  shadow.addEventListener("mouseout", (e) => {
    if ((e.target as HTMLElement).closest("[data-tip]")) {
      if (tooltipShowTimer !== null) {
        window.clearTimeout(tooltipShowTimer);
        tooltipShowTimer = null;
      }
      hideFloatingTooltip();
    }
  });

  shadow.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("details.dropdown")) return;
    const dd = shadow.querySelector<HTMLDetailsElement>(
      "details.dropdown[open]",
    );
    if (dd) dd.open = false;
  });

  const loadStudentsPage = async (reset: boolean) => {
    if (reset) {
      loading = true;
      authError = false;
      rerender();
    } else {
      if (loadingMore || entries.length >= filteredTotal) return;
      loadingMore = true;
      rerender();
    }

    const res = await fetchStudentsPage({
      offset: reset ? 0 : entries.length,
      limit: INITIAL_VISIBLE_COUNT,
      sort: sortField,
      dir: sortField === "name" ? nameDir : dateDir,
      filter,
      poolIntake,
      poolYear,
      query,
    });

    if (res?.unauthorized) {
      entries = [];
      lastFetched = 0;
      authError = true;
      baseTotal = 0;
      filteredTotal = 0;
      activeCount = 0;
    } else if (res?.data) {
      const page = res.data.data || [];
      entries = reset ? page : [...entries, ...page];
      baseTotal = res.data.total ?? entries.length;
      filteredTotal = res.data.filtered ?? entries.length;
      activeCount = res.data.active ?? 0;
      if (res.data.options) filterOptions = res.data.options;
      lastFetched = res.data.cached_at || 0;
      if (reset) visibleCount = INITIAL_VISIBLE_COUNT;
    } else if (reset) {
      entries = [];
      lastFetched = 0;
      baseTotal = 0;
      filteredTotal = 0;
      activeCount = 0;
      filterOptions = null;
    } else {
      filteredTotal = entries.length;
    }

    loading = false;
    loadingMore = false;
    rerender();
  };

  const load = async () => {
    if (tab === "students") {
      await loadStudentsPage(true);
      return;
    }
    loading = true;
    authError = false;
    rerender();
    let res: Awaited<ReturnType<typeof fetchPisciners>>;
    if (tab === "pisciners" && selectedPiscine) {
      res = await fetchPisciners(selectedPiscine.year, selectedPiscine.month);
    } else if (tab === "pisciners") {
      res = null;
    } else {
      res = await fetchFutureStudents();
    }
    if (res?.unauthorized) {
      entries = [];
      lastFetched = 0;
      authError = true;
    } else if (res?.data) {
      entries = sortEntries(
        res.data.data || [],
        tab,
        sortField,
        nameDir,
        dateDir,
      );
      lastFetched = res.data.cached_at || 0;
      visibleCount = INITIAL_VISIBLE_COUNT;
    } else {
      entries = [];
      lastFetched = 0;
    }
    loading = false;
    rerender();
  };

  const loadPiscineList = async () => {
    if (piscineListLoaded) {
      rerender();
      return;
    }
    piscineListLoading = true;
    rerender();
    const res = await fetchPiscines();
    if (res?.unauthorized) {
      piscineList = [];
      authError = true;
    } else if (res?.data) {
      piscineList = res.data.data || [];
    } else {
      piscineList = [];
    }
    piscineListLoading = false;
    piscineListLoaded = true;
    rerender();
  };

  const switchTab = async (t: StudentsTab) => {
    if (tab === t) return;
    tab = t;
    query = "";
    filter = "none";
    poolIntake = null;
    poolYear = null;
    visibleCount = INITIAL_VISIBLE_COUNT;
    if (tab === "pisciners") {
      selectedPiscine = null;
      rerender();
      await loadPiscineList();
      return;
    }
    rerender();
    await load();
  };

  const handlers: StudentsTemplateHandlers = {
    onSwitchTab: (t) => {
      void switchTab(t);
    },
    onSetView: setView,
    onSetSort: setSort,
    onToggleFilter: toggleFilter,
    onClose: close,
    onToggleMaximize: () => {
      isMaximized = !isMaximized;
      if (isMaximized) {
        dialog.dataset.prevWidth = dialog.style.width;
        dialog.dataset.prevHeight = dialog.style.height;
        dialog.dataset.prevMargin = dialog.style.margin;
        dialog.style.width = "calc(100dvw - 2rem)";
        dialog.style.height = "calc(100dvh - 2rem)";
        dialog.style.margin = "1rem auto";
      } else {
        dialog.style.width = dialog.dataset.prevWidth || "";
        dialog.style.height = dialog.dataset.prevHeight || "";
        dialog.style.margin = dialog.dataset.prevMargin || "";
      }
      rerender();
    },
    onSearchInput: (value) => {
      query = value;
      visibleCount = INITIAL_VISIBLE_COUNT;
      if (searchTimeout !== null) window.clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        if (tab === "students") {
          void loadStudentsPage(true);
          return;
        }
        rerender();
      }, 150);
    },
    onLoadMore: () => {
      if (tab === "students") void loadStudentsPage(false);
    },
    onSelectPiscine: (year, month) => {
      selectedPiscine = { year, month };
      visibleCount = INITIAL_VISIBLE_COUNT;
      void load();
    },
    onBackToPiscines: () => {
      selectedPiscine = null;
      visibleCount = INITIAL_VISIBLE_COUNT;
      rerender();
    },
    onPoolIntake: (value) => {
      const intakes =
        tab === "students"
          ? (filterOptions?.intakes ?? [])
          : poolIntakes(entries, currentYear);
      poolIntake = value === 0 ? null : (intakes[value - 1] ?? null);
      poolYear = null;
      visibleCount = INITIAL_VISIBLE_COUNT;
      if (tab === "students") {
        void loadStudentsPage(true);
        return;
      }
      rerender();
    },
    onPoolYear: (value) => {
      poolYear = value === 0 ? null : value;
      poolIntake = null;
      visibleCount = INITIAL_VISIBLE_COUNT;
      if (tab === "students") {
        void loadStudentsPage(true);
        return;
      }
      rerender();
    },
    onClearFilters: () => {
      filter = "none";
      poolIntake = null;
      poolYear = null;
      visibleCount = INITIAL_VISIBLE_COUNT;
      if (tab === "students") {
        void loadStudentsPage(true);
        return;
      }
      rerender();
    },
    onCopyLogin: (login) => {
      void navigator.clipboard.writeText(login);
      copiedLogin = login;
      if (copiedLoginTimeout !== null) window.clearTimeout(copiedLoginTimeout);
      copiedLoginTimeout = window.setTimeout(() => {
        copiedLoginTimeout = null;
        copiedLogin = null;
        rerender();
      }, 1500);
      rerender();
    },
    onConnect: () => {
      void loginWith42(async () => {
        await clearAuthFailed();
        window.location.reload();
      });
    },
  };

  const buildState = (): StudentsTemplateState => ({
    currentTheme,
    tab,
    view,
    sortField,
    nameDir,
    dateDir,
    filter,
    poolIntake,
    poolYear,
    piscineList,
    piscineListLoading,
    selectedPiscine,
    entries,
    loading,
    loadingMore,
    lastFetched,
    query,
    authError,
    visibleCount,
    baseTotal,
    filteredTotal,
    activeCount,
    filterOptions,
    currentYear,
    copiedLogin,
    isMaximized,
    tabsOverflowing,
  });

  const rerender = () => {
    render(renderStudentsDialogTemplate(buildState(), handlers), shadow);
    adoptShadowStyles(shadow);

    const scrollArea = shadow.querySelector<HTMLElement>(".scroll-area");
    if (scrollArea && !scrollArea.dataset.ftTooltipScroll) {
      scrollArea.dataset.ftTooltipScroll = "1";
      scrollArea.addEventListener("scroll", hideFloatingTooltip, {
        passive: true,
      });
    }

    if (sentinelObserver) {
      sentinelObserver.disconnect();
      sentinelObserver = null;
    }
    const sentinel = shadow.querySelector<HTMLElement>(".sentinel");
    if (sentinel) {
      const root = shadow.querySelector<HTMLElement>(".scroll-area");
      sentinelObserver = new IntersectionObserver(
        (observerEntries) => {
          if (!observerEntries.some((e) => e.isIntersecting)) return;
          if (tab === "students") {
            void loadStudentsPage(false);
            return;
          }
          visibleCount += WINDOW_STEP;
          rerender();
        },
        { root, rootMargin: "400px" },
      );
      sentinelObserver.observe(sentinel);
    }

    if (tabsResizeObserver) {
      tabsResizeObserver.disconnect();
      tabsResizeObserver = null;
    }
    const tabsHost = shadow.querySelector<HTMLElement>(".students-tabs-host");
    if (tabsHost) {
      tabsResizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          const overflowing = measureTabsOverflow(tabsHost);
          if (overflowing === tabsOverflowing) return;
          tabsOverflowing = overflowing;
          rerender();
        });
      });
      tabsResizeObserver.observe(tabsHost);
    }
  };

  rerender();
  document.body.appendChild(dialog);
  dialog.showModal();
  await load();
}
