export function initMilestones() {
  injectMilestoneStyles();
  enhanceMilestones();
}

function enhanceMilestones() {
  const validatedMilestones =
    document.querySelectorAll<HTMLElement>(".bg-legacy-main");

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
      border-radius: 10px;
      background: linear-gradient(135deg, #ff6a00, #ff8c00) !important;
      box-shadow: 0 0 12px rgba(30, 144, 255, 0.4);
      overflow: hidden;
      isolation: isolate;
    }

    .fire-milestone::before {
      content: "";
      position: absolute;
      inset: 0;
      padding: 4px;
      border-radius: inherit;
      background: conic-gradient(
        from var(--angle, 0deg),
        #ff6a00,
        #ff8c00,
        #ffb347,
        #ff8c00,
        #ff6a00
      );

      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;

      pointer-events: none;
      z-index: 2;
    }

    .fire-milestone > * {
      position: relative;
      z-index: 1;
    }

	.bg-legacy-main {
  border: 1px solid rgba(82, 255, 82, 0.35);
  box-shadow: 0 0 10px rgba(82, 255, 82, 0.15);
  border-radius: 12px;
}
  `;
  document.head.appendChild(style);
}
