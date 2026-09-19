import { vi } from "vitest";

const store = new Map<string, unknown>();

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | null) => {
        if (keys === null || keys === undefined) {
          return Object.fromEntries(store);
        }
        if (typeof keys === "string") {
          return { [keys]: store.get(keys) };
        }
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = store.get(key);
        }
        return result;
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        for (const [key, value] of Object.entries(items)) {
          store.set(key, value);
        }
        callback?.();
        return Promise.resolve();
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const key of list) {
          store.delete(key);
        }
      }),
      clear: vi.fn(async () => store.clear()),
    },
  },
};
