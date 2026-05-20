import { html, render } from "lit-html";

const GAME_CONTAINER_ID = "flagle-game-container";

function findGameMount(): HTMLElement | null {
  return [
    ...document.querySelectorAll('[class*="grid"]'),
  ].find((el) => el.children.length > 2 && el.offsetParent !== null) || null;
}

function renderGameContainer() {
  return html`
    <div
      id="${GAME_CONTAINER_ID}"
      class="bg-white dark:bg-zinc-900 overflow-hidden md:drop-shadow-md md:rounded-lg p-0 mb-4 transition-all w-full"
    >
      <div class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
        <div class="font-bold text-black dark:text-white uppercase text-sm tracking-tight flex items-center w-full">
          <div class="w-1.5 h-4 bg-legacy-main rounded-full mr-2"></div>
          Flagle Unlimited
          <span class="ml-auto bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case border border-blue-500/30">
            Mini-Game
          </span>
        </div>
      </div>

      <div class="relative w-full overflow-hidden bg-white" style="height: 768px;">
        <iframe
          src="https://flagle-game.com/unlimited"
          style="
            position: absolute;
            top: -60px;
            left: 0;
            width: 100%;
            height: calc(100% + 60px);
            border: none;
            transform: scale(1.1);
            transform-origin: top center;
          "
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;
}

function injectGame(): boolean {
  if (document.getElementById(GAME_CONTAINER_ID)) return true;

  const mount = findGameMount();
  if (!mount) return false;

  const container = document.createElement("div");
  render(renderGameContainer(), container);
  
  const gameBox = container.firstElementChild as HTMLElement;
  if (gameBox) {
    mount.appendChild(gameBox);
    return true;
  }
  
  return false;
}

function isProfileV3TargetPage() {
  return location.hostname === "profile-v3.intra.42.fr" &&
    (location.pathname === "/" || location.pathname === "" || /^\/users\/[^/]+\/?$/.test(location.pathname));
}

export async function initFlagleGame() {
  if (!isProfileV3TargetPage()) return;

  injectGame();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(GAME_CONTAINER_ID)) {
      if (injectGame()) {
        observer.disconnect();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}