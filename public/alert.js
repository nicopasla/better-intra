const params = new URLSearchParams(window.location.search);
document.getElementById("title").textContent = params.get("title") ?? "";
document.getElementById("message").textContent = params.get("message") ?? "";
document.getElementById("time").textContent = params.get("time") ?? "";
document.getElementById("dismiss").addEventListener("click", () => window.close());

const link = params.get("link");
if (link) {
  const linkEl = document.getElementById("link");
  linkEl.href = link;
  linkEl.style.display = "block";
}