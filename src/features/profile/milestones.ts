export function initMilestones() {
  injectMilestoneStyles();
  enhanceMilestones();
}

function enhanceMilestones() {
  const validatedMilestones =
    document.querySelectorAll<HTMLElement>(".bg-legacy-main[data-state]");

  validatedMilestones.forEach((milestone) => {
    if (milestone.dataset.fireEnhanced) return;

    milestone.dataset.fireEnhanced = "true";
    milestone.classList.add("fire-milestone");

    let angle = 0;

    function animate() {
      angle = (angle + 1.2) % 360;
      milestone.style.setProperty("--angle", `${angle}deg`);
      requestAnimationFrame(animate);
    }

    animate();
  });
}

function injectMilestoneStyles() {
  if (document.getElementById("fire-milestone-style")) return;
  const style = document.createElement("style");
  style.id = "fire-milestone-style";
  style.textContent = `
    .fire-milestone {
      position: relative;
      overflow: hidden;
      isolation: isolate;
      border-radius: 16px;
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

    .fire-milestone::before {
      content: "";
      position: absolute;
      inset: 0;
      padding: 3px;
      border-radius: inherit;
      background:
        conic-gradient(
          from var(--angle, 0deg),
          #ff3c00,
          #ff7b00,
          #ffd000,
          #fff0a0,
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
    }
    .fire-milestone::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;

      background:
        conic-gradient(
          from var(--angle, 0deg),
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

      filter:
        blur(18px)
        brightness(1.4);
      opacity: 0.4;
      z-index: 0;
      pointer-events: none;
    }

    .fire-milestone > * {
      position: relative;
      z-index: 2;
    }

    .bg-legacy-main {
      border-radius: 16px;
    }
`;
  document.head.appendChild(style);
}
