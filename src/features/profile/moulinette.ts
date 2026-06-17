import robotSvgRaw from "../../assets/svg/robot.svg?raw";
import robotBrokenSvgRaw from "../../assets/svg/robot-broken.svg?raw";

export function replaceMoulinetteImage() {
  const headers = document.querySelectorAll<HTMLElement>(".corrected-header");
  for (const header of headers) {
    const span = header.querySelector("span");
    if (span?.textContent?.trim() !== "moulinette") continue;

    const item = header.closest(".corrected-item");
    const el = item?.querySelector<HTMLElement>(".bg-image-item");
    if (!el) continue;

    const isFailed = header.querySelector(".text-danger");
    const svg = isFailed ? robotBrokenSvgRaw : robotSvgRaw;

    const dataUri = "data:image/svg+xml," + encodeURIComponent(svg);
    el.style.backgroundImage = `url("${dataUri}")`;
    el.style.backgroundColor = "transparent";
    el.style.backgroundSize = "contain";
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundPosition = "center";
    el.style.borderRadius = "0";
  }
}
