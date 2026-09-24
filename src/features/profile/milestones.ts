import { waitFor } from "../../utils/wait-for.ts";

let milestonesStarted = false;

export function initMilestones() {
  injectMilestoneStyles();
  if (milestonesStarted) return;
  milestonesStarted = true;
  const hasMilestones = () => {
    const validated = document.querySelectorAll<HTMLElement>(
      ".bg-legacy-main.h-10[data-state]",
    );
    const muted = document.querySelectorAll<HTMLElement>(
      ".bg-legacy-main-muted.h-10[data-state]",
    );
    return validated.length > 0 || muted.length > 0;
  };
  void waitFor(hasMilestones).then((ok) => {
    if (ok) enhanceMilestones();
  });
}

function enhanceMilestones() {
  const validated = document.querySelectorAll<HTMLElement>(
    ".bg-legacy-main.h-10[data-state]",
  );
  const muted = document.querySelectorAll<HTMLElement>(
    ".bg-legacy-main-muted.h-10[data-state]",
  );

  validated.forEach((el) => {
    if (el.dataset.fireBg) return;
    el.dataset.fireBg = "true";
    el.classList.add("fire-bg");
  });

  if (muted.length > 0) {
    const current = muted[0];
    if (!current.dataset.fireAnimated) {
      current.dataset.fireAnimated = "true";
      current.classList.add("fire-animated");
    }
  }
}

function injectMilestoneStyles() {
  if (document.getElementById("fire-milestone-style")) return;
  const style = document.createElement("style");
  style.id = "fire-milestone-style";
  style.textContent = `
    @property --ft-angle {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }

    @keyframes ft-fire-turn {
      from { --ft-angle: 0deg; }
      to { --ft-angle: 360deg; }
    }

    .fire-bg.h-10 {
      position: relative;
      overflow: hidden;
      isolation: isolate;
      border-radius: 4px;
      background:
        linear-gradient(
          135deg,
          #ff6a00 0%,
          #ff8c00 40%,
          #ff9f1c 100%
        ) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.15),
        inset 0 -8px 18px rgba(0,0,0,0.18);
    }

    .fire-animated.h-10 {
      position: relative;
      overflow: hidden;
      isolation: isolate;
      border-radius: 4px;
    }

    .fire-animated::before {
      content: "";
      position: absolute;
      inset: 0;
      padding: 4px;
      border-radius: inherit;
      background:
        conic-gradient(
          from var(--ft-angle, 0deg),
          #ff3c00,
          #ff7b00,
          #ffd000,
          #ff7b00,
          #ff3c00
        );
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      z-index: 3;
      pointer-events: none;
      will-change: background;
      animation: ft-fire-turn 3s linear infinite;
    }

    html.ft-no-anim .fire-animated::before {
      animation: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .fire-animated::before {
        animation: none;
      }
    }

    .fire-animated > * {
      position: relative;
      z-index: 2;
    }

    div:has(> .bg-red-500.rounded-full.h-3.w-3) {
      position: relative;
      z-index: 1;
      margin-top: -5rem !important;
    }

    .bg-red-500.rounded-full + .w-\\[2px\\] {
      height: 75px;
    }

    .h-\\[59\\%\\].justify-between {
      justify-content: flex-start;
      padding-bottom: 0 !important;
    }
  `;
  document.head.appendChild(style);
}
