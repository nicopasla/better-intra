import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
import GLOBE from "../../assets/svg/globe.svg";

export const SHORTCUTS_FEATURE_ID = "shortcuts";

export interface ShortcutLink {
  name: string;
  url: string;
  color: string;
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
  if (!link || typeof link !== "object") {
    return { name: "", url: "", color: "#7dd3fc" };
  }

  const obj = link as Record<string, unknown>;
  return {
    name: typeof obj.name === "string" ? obj.name.trim() : "",
    url: sanitizeUrl(obj.url),
    color: sanitizeColor(obj.color),
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

      <div class="divider my-1"></div>
      <div
        class="preview-section p-4 rounded-xl border border-base-300 bg-base-200/10"
      >
        <div class="flex justify-center">${renderShortcutsDisplay(links)}</div>
      </div>
    </div>
  `;
}

export async function getStoredLinks(): Promise<ShortcutLink[]> {
  const stored = await getConfig("SHORTCUTS_LINKS");

  if (!stored) {
    return [{ name: "", url: "", color: "#7dd3fc" }];
  }

  try {
    if (typeof stored === "string") {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed))
        return [{ name: "", url: "", color: "#7dd3fc" }];
      const normalized = parsed.map(normalizeLink).slice(0, 8);
      return normalized.length
        ? normalized
        : [{ name: "", url: "", color: "#7dd3fc" }];
    }
    if (Array.isArray(stored)) {
      const normalized = stored.map(normalizeLink).slice(0, 8);
      return normalized.length
        ? normalized
        : [{ name: "", url: "", color: "#7dd3fc" }];
    }
  } catch {
    return [{ name: "", url: "", color: "#7dd3fc" }];
  }

  return [{ name: "", url: "", color: "#7dd3fc" }];
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

    if (nameInput && urlInput && colorInput) {
      const link = normalizeLink({
        name: nameInput.value,
        url: urlInput.value,
        color: colorInput.value,
      });

      if (link.url && link.name) {
        links.push(link);
      }
    }
  });

  return links;
}

export function renderShortcutsDisplay(
  links: ShortcutLink[],
): ReturnType<typeof html> {
  const activeLinks = links.filter((l) => l.url && l.name);

  if (activeLinks.length === 0) return html``;

  return html`
    <div class="flex flex-wrap gap-3 p-1" id="shortcuts-display">
      ${activeLinks.map((link) => {
        const contrast = getContrastColor(link.color);
        return html`
          <a
            href="${link.url}"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-lg transition-all duration-300 hover:ring-2"
            style="
              background-color: ${link.color};
              color: ${contrast};
              --tw-ring-color: ${link.color};
              --tw-ring-offset-color: transparent;
            "
          >
            <div
              class=" p-1 rounded-md group-hover:rotate-6 transition-transform"
            >
              <img
                src="${getFaviconUrl(link.url)}"
                class="w-8 h-8 object-contain"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="${(e: Event) => {
                  const img = e.target as HTMLImageElement;
                  img.onerror = null;
                  img.src = GLOBE;
                }}"
              />
            </div>

            <span class="text-[11px] font-bold tracking-wide uppercase">
              ${link.name}
            </span>
          </a>
        `;
      })}
    </div>
  `;
}

export async function initShortcutsSettings(container: HTMLElement) {
  let links: ShortcutLink[] = await getStoredLinks();

  const save = async () => {
    const updated = extractLinksFromForm(container);
    await browser.storage.local.set({
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
          await save();
          update();
        },
        async () => {
          await save();
        },
        () => update(),
      ),
      container,
    );
  };

  update();
}
