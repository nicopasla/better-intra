export function onVisible(cb: () => void): () => void {
  const handler = () => {
    if (!document.hidden) cb();
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}
