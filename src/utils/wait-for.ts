type Waiter = {
  check: () => boolean;
  resolve: (value: boolean) => void;
  deadline: number;
};

let waiters: Waiter[] = [];
let passTimer: number | null = null;
let observer: MutationObserver | null = null;
let runningPass = false;

const PASS_MS = 80;

function runPass(): void {
  if (runningPass) return;
  runningPass = true;
  try {
    const now = Date.now();
    waiters = waiters.filter((w) => {
      if (now >= w.deadline) {
        w.resolve(false);
        return false;
      }
      if (w.check()) {
        w.resolve(true);
        return false;
      }
      return true;
    });
  } finally {
    runningPass = false;
  }
  if (waiters.length === 0) teardown();
}

function startSweep(): void {
  if (passTimer !== null || waiters.length === 0) return;
  passTimer = window.setTimeout(() => {
    passTimer = null;
    runPass();
    if (waiters.length > 0) startSweep();
  }, PASS_MS);
}

function startObserver(): void {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(() => runPass());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function teardown(): void {
  if (passTimer !== null) {
    clearTimeout(passTimer);
    passTimer = null;
  }
  observer?.disconnect();
  observer = null;
}

export function waitFor(
  check: () => boolean,
  timeoutMs = 10000,
): Promise<boolean> {
  if (check()) return Promise.resolve(true);
  if (typeof window === "undefined") return Promise.resolve(false);
  startObserver();
  startSweep();
  const promise = new Promise<boolean>((resolve) => {
    waiters.push({ check, resolve, deadline: Date.now() + timeoutMs });
  });
  queueMicrotask(runPass);
  return promise;
}

export async function waitForSelector(
  selector: string,
  root: ParentNode = document,
  timeoutMs = 10000,
): Promise<Element | null> {
  const found = await waitFor(
    () => root.querySelector(selector) !== null,
    timeoutMs,
  );
  return found ? root.querySelector(selector) : null;
}