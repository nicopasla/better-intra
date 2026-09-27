import { html, render } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { repeat } from "lit-html/directives/repeat.js";
import { getConfig } from "../../config.ts";
import { createSortable } from "../../utils/sortable.ts";
import { contrastText } from "../../utils/color.ts";
import GLOBE from "../../assets/svg/globe.svg";

export interface ShortcutLink {
  name: string;
  url: string;
  color: string;
  emoji?: string;
  _id?: string;
}

let _idCounter = 0;
const ensureId = (link: ShortcutLink): ShortcutLink => {
  if (!link._id) link._id = `sc-${_idCounter++}`;
  return link;
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

let shortcutsSortable: { destroy: () => void } | null = null;

export const sanitizeColor = (color: unknown): string => {
  const colorStr = String(color || "").trim();
  return HEX_COLOR_RE.test(colorStr) ? colorStr : "#7dd3fc";
};

export const sanitizeUrl = (url: unknown): string => {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    return /^https?:$/i.test(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

export const normalizeLink = (link: unknown): ShortcutLink => {
  const obj = link as Record<string, unknown>;
  return {
    name: typeof obj.name === "string" ? obj.name.trim() : "",
    url: sanitizeUrl(obj.url),
    color: sanitizeColor(obj.color),
    emoji: typeof obj.emoji === "string" ? obj.emoji.trim() : "",
    _id: typeof obj._id === "string" ? obj._id : undefined,
  };
};

export const getFaviconUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "";
  }
};

export const getContrastColor = (hex: string): string => contrastText(hex);

export function renderShortcutRow(
  link: ShortcutLink,
  onDelete: () => void,
): ReturnType<typeof html> {
  return html` <div
    class="link-group flex flex-row gap-2 border border-base-300 rounded-lg p-2 bg-base-200/30 items-end"
  >
    <span
      class="ft-shortcut-grip self-stretch flex items-center justify-center px-1 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-80"
      title="Drag to reorder"
      >⠿</span
    >
    <div class="flex flex-row gap-2">
      <input
        type="text"
        class="input w-16 text-center text-xl"
        data-shortcuts-emoji
        .value="${link.emoji || ""}"
        placeholder="🐝"
        maxlength="2"
      />
    </div>
    <div class="flex-1">
      <input
        type="text"
        class="input w-full"
        data-shortcuts-name
        .value="${link.name}"
        placeholder="Name"
        maxlength="20"
      />
    </div>
    <div class="flex-2">
      <input
        type="url"
        class="input w-full"
        placeholder="https://example.com"
        .value="${link.url}"
        data-shortcuts-url
        pattern="^(https?://)?.*"
      />
    </div>
    <input
      type="color"
      class="input w-12 p-1 cursor-pointer"
      data-shortcuts-color
      .value="${link.color}"
    />
    <button
      type="button"
      class="btn btn-outline btn-error"
      @click="${onDelete}"
    >
      ✕
    </button>
  </div>`;
}

export function renderShortcutsSettings(
  links: ShortcutLink[],
  onAddRow: () => void,
  onDeleteRow: (index: number) => void,
  onInput: () => void,
  onRefreshPreview: () => void,
  onMoveRow: (from: number, to: number) => void,
): ReturnType<typeof html> {
  const maxLinks = 8;
  const isFull = links.length >= maxLinks;

  const setupSortable = (el: Element | undefined) => {
    shortcutsSortable?.destroy();
    shortcutsSortable = null;
    if (!el) return;
    shortcutsSortable = createSortable(el as HTMLElement, {
      draggable: ".link-group",
      handle: ".ft-shortcut-grip",
      onReorder: (from, to) => onMoveRow(from, to),
    });
  };

  return html`
    <div class="shortcuts-settings flex flex-col gap-4">
      <div class="space-y-2" @input="${onInput}" ${ref(setupSortable)}>
        ${repeat(
          links,
          (link) => ensureId(link)._id!,
          (link, idx) => renderShortcutRow(link, () => onDeleteRow(idx)),
        )}
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-success flex-1 font-mono"
          @click="${onAddRow}"
          ?disabled="${isFull}"
        >
          ${isFull
            ? "Limit Reached"
            : html`Add Link (${links.length}/${maxLinks})`}
        </button>

        <button
          type="button"
          class="btn btn-info px-6"
          @click="${onRefreshPreview}"
        >
          Update Preview
        </button>
      </div>

      ${links.length > 0
        ? html`
            <div class="divider my-1"></div>
            <div
              class="preview-section p-4 rounded-xl border border-base-300 bg-base-200/10"
            >
              <div class="flex justify-center">
                ${renderShortcutsDisplay(links)}
              </div>
            </div>
          `
        : ""}
    </div>
  `;
}

export async function getStoredLinks(): Promise<ShortcutLink[]> {
  const stored = await getConfig("SHORTCUTS_LINKS");
  const fallback = [{ name: "", url: "", color: "#7dd3fc", emoji: "" }];
  if (!stored) return fallback;
  try {
    let parsed: any;
    if (typeof stored === "string") {
      parsed = JSON.parse(stored);
    } else {
      parsed = stored;
    }
    if (!Array.isArray(parsed)) return fallback;
    const normalized = parsed.map(normalizeLink).slice(0, 8);
    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

export function extractLinksFromForm(root: HTMLElement): ShortcutLink[] {
  const rows = root.querySelectorAll(".link-group");
  const links: ShortcutLink[] = [];

  rows.forEach((row) => {
    const nameInput = row.querySelector(
      "[data-shortcuts-name]",
    ) as HTMLInputElement;
    const urlInput = row.querySelector(
      "[data-shortcuts-url]",
    ) as HTMLInputElement;
    const colorInput = row.querySelector(
      "[data-shortcuts-color]",
    ) as HTMLInputElement;
    const emojiInput = row.querySelector(
      "[data-shortcuts-emoji]",
    ) as HTMLInputElement;

    if (nameInput && urlInput && colorInput) {
      const link = normalizeLink({
        name: nameInput.value,
        url: urlInput.value,
        color: colorInput.value,
        emoji: emojiInput ? emojiInput.value : "",
      });

      if (link.url && link.name) {
        links.push(link);
      }
    }
  });

  return links;
}

function renderLinkContent(
  link: ShortcutLink,
  contrast: string,
  hasEmoji: boolean,
): ReturnType<typeof html> {
  return html`
    <div
      class="flex items-center justify-center bg-white/20 p-1 rounded-lg transition-transform hover:rotate-6 w-10 h-10"
    >
      ${hasEmoji
        ? html`<span class="text-2xl">${link.emoji}</span>`
        : html`
            <img
              src="${getFaviconUrl(link.url || "https://example.com")}"
              class="w-8 h-8 object-contain"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="${(e: Event) => {
                const img = e.target as HTMLImageElement;
                try {
                  const parsedUrl = new URL(link.url);
                  if (!img.hasAttribute("data-fallback-tried")) {
                    img.setAttribute("data-fallback-tried", "true");
                    img.src = `https://icons.duckduckgo.com/ip3/${parsedUrl.hostname}.ico`;
                    return;
                  }
                } catch {}
                img.onerror = null;
                img.src = GLOBE;
              }}"
            />
          `}
    </div>
    <span class="text-sm"> ${link.name || "Empty"} </span>
  `;
}

export function renderShortcutsDisplay(
  links: ShortcutLink[],
  openNewTab = true,
): ReturnType<typeof html> {
  const displayLinks = links.filter((l) => l.url && l.name);

  if (displayLinks.length === 0) return html``;

  return html`
    <div
      class="flex flex-wrap gap-3 p-0 m-0 items-center"
      id="shortcuts-display"
    >
      ${repeat(
        displayLinks,
        (link) => ensureId(link)._id!,
        (link) => {
          const contrast = getContrastColor(link.color);
          const hasEmoji = !!(link.emoji && link.emoji.trim().length > 0);

          return html`<a
            href="${link.url}"
            target="${openNewTab ? "_blank" : ""}"
            rel="${openNewTab ? "noopener noreferrer" : ""}"
            class="btn btn-lg h-auto min-h-12 px-4 py-2 rounded-2xl border-none font-bold uppercase tracking-wider shadow-lg hover:shadow-lg no-underline inline-flex items-center gap-3"
            style="background-color: ${link.color}; color: ${contrast};"
          >
            ${renderLinkContent(link, contrast, hasEmoji)}
          </a>`;
        },
      )}
    </div>
  `;
}
