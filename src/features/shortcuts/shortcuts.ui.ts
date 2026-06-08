import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
import GLOBE from "../../assets/svg/globe.svg";

export interface ShortcutLink {
  name: string;
  url: string;
  color: string;
  emoji?: string;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

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

export const getContrastColor = (hex: string): string => {
  const safeHex = sanitizeColor(hex);
  const r = parseInt(safeHex.slice(1, 3), 16);
  const g = parseInt(safeHex.slice(3, 5), 16);
  const b = parseInt(safeHex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "#000000" : "#ffffff";
};

export function renderShortcutRow(
  link: ShortcutLink,
  onDelete: () => void,
): ReturnType<typeof html> {
  return html` <div
    class="link-group flex flex-row gap-2 border border-base-300 rounded-lg p-2 bg-base-200/30 items-end"
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

  return html`
    <div class="shortcuts-settings flex flex-col gap-4">
      <div class="space-y-2" @input="${onInput}">
        ${links.map((link, idx) =>
          renderShortcutRow(link, () => onDeleteRow(idx)),
        )}
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-success flex-1"
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

      ${links.length > 0 ? html`
        <div class="divider my-1"></div>
        <div
          class="preview-section p-4 rounded-xl border border-base-300 bg-base-200/10"
        >
          <div class="flex justify-center">
            ${renderShortcutsDisplay(links, onMoveRow)}
          </div>
        </div>
      ` : ''}
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
  onMoveRow?: (from: number, to: number) => void,
): ReturnType<typeof html> {
  const isDragMode = !!onMoveRow;
  const displayLinks = isDragMode
    ? links
    : links.filter((l) => l.url && l.name);

  if (displayLinks.length === 0) return html``;

  return html`
    <div
      class="flex flex-wrap gap-3 p-0 m-0 items-center"
      id="shortcuts-display"
    >
      ${displayLinks.map((link, idx) => {
        const contrast = getContrastColor(link.color);
        const hasEmoji = !!(link.emoji && link.emoji.trim().length > 0);
        const isValid = link.url && link.name;

        if (isDragMode) {
          const dimmed = !isValid;

          return html`<a
            href="${isValid ? link.url : "#"}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-lg h-auto min-h-12 px-4 py-2 rounded-2xl border-none font-bold uppercase tracking-wider shadow-lg hover:shadow-lg no-underline inline-flex items-center gap-3 ${dimmed
              ? "opacity-40 grayscale"
              : ""}"
            style="background-color: ${link.color}; color: ${contrast};"
            draggable="${isValid}"
            @dragstart="${(e: DragEvent) => {
              if (!isValid) {
                e.preventDefault();
                return;
              }
              e.dataTransfer?.setData("text/plain", String(idx));
              (e.currentTarget as HTMLElement).classList.add("opacity-30");
            }}"
            @dragover="${(e: DragEvent) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).classList.add(
                "ring-2",
                "ring-primary",
              );
            }}"
            @dragleave="${(e: DragEvent) => {
              (e.currentTarget as HTMLElement).classList.remove(
                "ring-2",
                "ring-primary",
              );
            }}"
            @drop="${(e: DragEvent) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).classList.remove(
                "ring-2",
                "ring-primary",
              );
              const fromIdx = parseInt(
                e.dataTransfer?.getData("text/plain") || "-1",
              );
              if (fromIdx !== -1 && fromIdx !== idx) {
                onMoveRow!(fromIdx, idx);
              }
            }}"
            @dragend="${(e: DragEvent) => {
              (e.currentTarget as HTMLElement).classList.remove(
                "opacity-30",
                "ring-2",
                "ring-primary",
              );
            }}"
          >
            ${renderLinkContent(link, contrast, hasEmoji)}
          </a>`;
        }

        return html`<a
          href="${link.url}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-lg h-auto min-h-12 px-4 py-2 rounded-2xl border-none font-bold uppercase tracking-wider shadow-lg hover:shadow-lg no-underline inline-flex items-center gap-3"
          style="background-color: ${link.color}; color: ${contrast};"
        >
          ${renderLinkContent(link, contrast, hasEmoji)}
        </a>`;
      })}
    </div>
  `;
}

async function initShortcutsSettings(container: HTMLElement) {
  let links: ShortcutLink[] = await getStoredLinks();

  const save = async () => {
    const updated = extractLinksFromForm(container);
    await chrome.storage.local.set({
      SHORTCUTS_LINKS: JSON.stringify(updated),
    });
  };

  const update = () => {
    render(
      renderShortcutsSettings(
        links,
        () => {
          if (links.length < 8) {
            links = [...links, { name: "", url: "", color: "#7dd3fc" }];
            update();
          }
        },
        async (idx) => {
          links = links.filter((_, i) => i !== idx);
          if (links.length === 0) {
            links = [{ name: "", url: "", color: "#7dd3fc", emoji: "" }];
          }
          await save();
          update();
        },
        async () => {
          await save();
        },
        () => update(),
        () => {},
      ),
      container,
    );
  };

  update();
}
