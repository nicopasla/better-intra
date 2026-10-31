import { html, TemplateResult } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import EYE_SVG from "../../assets/svg/eye.svg?raw";
import EYE_SLASH_SVG from "../../assets/svg/eye-slash.svg?raw";

export interface AvatarEditorState {
  url: string;
  posX: number;
  posY: number;
  scale: number;
  bgColor: string;
  shape: "round" | "square";
  decoration: string;
}

const SCALE_MIN = 50;
const SCALE_MAX = 200;
const SCALE_STEP = 5;
const PREVIEW_SIZE = 208;

export interface AvatarEditorOptions {
  showingOriginal?: boolean;
  onToggleOriginal?: () => void;
}

export function renderAvatarEditor(
  state: AvatarEditorState,
  onUpdate: (changes: Partial<AvatarEditorState>) => void,
  options: AvatarEditorOptions = {},
): TemplateResult {
  const { showingOriginal = false, onToggleOriginal } = options;
  const decoBoxShadow =
    state.decoration === "solid" ? "box-shadow: 0 0 0 4px #00babc;" : "";

  return html`
    <div
      class="relative"
      style="width:${PREVIEW_SIZE}px;height:${PREVIEW_SIZE}px;flex-shrink:0;"
    >
      <div
        id="ft-avatar-preview"
        style="box-sizing:border-box;width:100%;height:100%;border:2px solid rgba(128,128,128,.6);border-radius:${state.shape ===
        "square"
          ? "0"
          : "9999px"};background-image:${state.url
          ? `url("${state.url}")`
          : "none"};background-size:${state.scale}%;background-position:${state.posX}% ${state.posY}%;background-color:${state.bgColor};background-repeat:no-repeat;${decoBoxShadow}cursor:${showingOriginal
          ? "default"
          : "grab"};flex-shrink:0;user-select:none;"
        @mousedown="${showingOriginal
          ? undefined
          : onPreviewMouseDown(onUpdate)}"
        @wheel="${showingOriginal
          ? undefined
          : onPreviewWheel(onUpdate, state)}"
      ></div>
      ${onToggleOriginal
        ? html`
            <button
              type="button"
              class="btn btn-xs btn-circle btn-ghost absolute top-1 right-1 bg-base-100/80 backdrop-blur border border-base-300"
              aria-label="${showingOriginal
                ? "View custom avatar"
                : "View original avatar"}"
              data-tip="${showingOriginal
                ? "View custom avatar"
                : "View original avatar"}"
              @mousedown="${(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
              }}"
              @click="${(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleOriginal();
              }}"
            >
              <span class="[&_svg]:w-4 [&_svg]:h-4"
                >${unsafeHTML(showingOriginal ? EYE_SLASH_SVG : EYE_SVG)}</span
              >
            </button>
          `
        : ""}
    </div>
    ${showingOriginal
      ? html`
          <div class="w-full text-xs opacity-60 text-center pt-1">
            Showing original 42 avatar
          </div>
        `
      : html`
          <div class="w-full flex flex-col gap-1 pt-2">
            <span class="text-sm opacity-70">Zoom</span>
            <div class="join w-full">
              <button
                type="button"
                class="btn join-item flex-1"
                aria-label="Zoom out"
                ?disabled="${state.scale <= SCALE_MIN}"
                @click="${() => {
                  const s = Math.max(SCALE_MIN, state.scale - SCALE_STEP);
                  if (s !== state.scale) onUpdate({ scale: s });
                }}"
              >
                −
              </button>
              <div
                class="btn join-item flex-1 font-mono pointer-events-none"
                aria-live="polite"
              >
                ${state.scale}%
              </div>
              <button
                type="button"
                class="btn join-item flex-1"
                aria-label="Zoom in"
                ?disabled="${state.scale >= SCALE_MAX}"
                @click="${() => {
                  const s = Math.min(SCALE_MAX, state.scale + SCALE_STEP);
                  if (s !== state.scale) onUpdate({ scale: s });
                }}"
              >
                +
              </button>
            </div>
          </div>
        `}
  `;
}

function onPreviewMouseDown(
  onUpdate: (changes: Partial<AvatarEditorState>) => void,
) {
  return (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const size = rect.width;

    const style = el.getAttribute("style") || "";
    const scaleMatch = style.match(/background-size:\s*([\d.]+)%/);
    const posMatch = style.match(
      /background-position:\s*([\d.]+)%\s+([\d.]+)%/,
    );
    const startScale = scaleMatch ? parseFloat(scaleMatch[1]) : 100;
    const startPosX = posMatch ? parseFloat(posMatch[1]) : 50;
    const startPosY = posMatch ? parseFloat(posMatch[2]) : 50;

    const sign = startScale < 100 ? 1 : -1;
    const speed = 10000 / startScale;

    const onMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const dPosX = sign * (dx / size) * speed;
      const dPosY = sign * (dy / size) * speed;

      onUpdate({
        posX: Math.round(Math.max(0, Math.min(100, startPosX + dPosX))),
        posY: Math.round(Math.max(0, Math.min(100, startPosY + dPosY))),
      });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      el.style.cursor = "grab";
    };

    el.style.cursor = "grabbing";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
}

function onPreviewWheel(
  onUpdate: (changes: Partial<AvatarEditorState>) => void,
  state: AvatarEditorState,
) {
  return (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = -Math.sign(e.deltaY) * SCALE_STEP;
    const newScale = Math.max(
      SCALE_MIN,
      Math.min(SCALE_MAX, state.scale + delta),
    );
    if (newScale !== state.scale) {
      onUpdate({ scale: newScale });
    }
  };
}
