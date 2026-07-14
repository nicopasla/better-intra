import { html, TemplateResult } from "lit-html";

export interface AvatarEditorState {
  url: string;
  posX: number;
  posY: number;
  scale: number;
  bgColor: string;
  decoration: string;
}

const SCALE_MIN = 50;
const SCALE_MAX = 200;
const SCALE_STEP = 5;
const PREVIEW_SIZE = 208;

export function renderAvatarEditor(
  state: AvatarEditorState,
  onUpdate: (changes: Partial<AvatarEditorState>) => void,
): TemplateResult {
  const decoBoxShadow =
    state.decoration === "solid" ? "box-shadow: 0 0 0 4px #00babc;" : "";

  return html`
    <div
      id="ft-avatar-preview"
      style="width:${PREVIEW_SIZE}px;height:${PREVIEW_SIZE}px;border-radius:9999px;background-image:${state.url
        ? `url("${state.url}")`
        : "none"};background-size:${state.scale}%;background-position:${state.posX}% ${state.posY}%;background-color:${state.bgColor};background-repeat:no-repeat;${decoBoxShadow}cursor:grab;flex-shrink:0;user-select:none;"
      @mousedown="${onPreviewMouseDown(onUpdate)}"
      @wheel="${onPreviewWheel(onUpdate, state)}"
    ></div>
    <div class="w-full flex flex-col gap-2">
      <div class="flex items-center justify-between gap-1">
        <span class="text-xs opacity-60">Zoom</span>
        <div class="flex items-center gap-1">
          <button
            class="btn btn-xs btn-ghost"
            ?disabled="${state.scale <= SCALE_MIN}"
            @click="${() => {
              const s = Math.max(SCALE_MIN, state.scale - SCALE_STEP);
              if (s !== state.scale) onUpdate({ scale: s });
            }}"
          >
            −
          </button>
          <span class="text-xs font-mono w-10 text-center"
            >${state.scale}%</span
          >
          <button
            class="btn btn-xs btn-ghost"
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
    </div>
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
