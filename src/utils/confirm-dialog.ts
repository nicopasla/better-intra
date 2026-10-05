import { html, render } from "lit-html";
import { adoptShadowStyles } from "./shadow-styles.ts";

const DIALOG_ID = "ft-confirm-dialog";

interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface AlertDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
}

function createDialogElement(): HTMLDialogElement {
  document.getElementById(DIALOG_ID)?.remove();

  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "bg-transparent backdrop:bg-black/50";
  dialog.style.margin = "auto";
  dialog.style.padding = "0";
  dialog.style.border = "none";
  dialog.style.borderRadius = "1rem";
  dialog.style.maxWidth = "26rem";
  dialog.style.width = "calc(100dvw - 2rem)";
  return dialog;
}

export async function showConfirmDialog(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  const {
    title = "Confirm",
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
  } = options;

  const dialog = createDialogElement();

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });

  let resolvePromise!: (value: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolvePromise = r));

  const resolve = (value: boolean) => {
    dialog.close();
    dialog.remove();
    resolvePromise(value);
  };

  render(
    html`
      <div
        data-theme="light"
        class="alert shadow-2xl flex flex-col items-stretch"
        style="border-radius:1rem;"
      >
        <div class="flex items-start gap-3 w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="h-6 w-6 shrink-0 stroke-current mt-0.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div class="flex flex-col gap-1 text-left">
            <h3 class="font-bold text-base">${title}</h3>
            <p class="text-sm opacity-80">${message}</p>
          </div>
        </div>
        <div class="flex gap-2 mt-2 w-full">
          <button
            class="btn btn-md flex-1 ${danger
              ? "btn-ghost"
              : "btn-error"} font-bold"
            @click="${() => resolve(false)}"
          >
            ${cancelLabel}
          </button>
          <button
            class="btn btn-md flex-1 ${danger
              ? "btn-error"
              : "btn-success"} font-bold"
            @click="${() => resolve(true)}"
          >
            ${confirmLabel}
          </button>
        </div>
      </div>
    `,
    shadow,
  );
  adoptShadowStyles(shadow);

  dialog.appendChild(host);
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) resolve(false);
  });

  return promise;
}

export async function showAlertDialog(
  options: AlertDialogOptions,
): Promise<void> {
  const { title = "Notice", message, confirmLabel = "OK" } = options;

  const dialog = createDialogElement();

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });

  await new Promise<void>((resolvePromise) => {
    const resolve = () => {
      dialog.close();
      dialog.remove();
      resolvePromise();
    };

    render(
      html`
        <div
          data-theme="light"
          class="alert items-start shadow-2xl flex flex-col items-stretch"
          style="border-radius:1rem;"
        >
          <div class="flex items-start gap-3 w-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="h-6 w-6 shrink-0 stroke-current mt-0.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="flex flex-col gap-1 text-left">
              <h3 class="font-bold text-base">${title}</h3>
              <p class="text-sm opacity-80">${message}</p>
            </div>
          </div>
          <div class="mt-2 w-full">
            <button
              class="btn btn-md w-full btn-success font-bold"
              @click="${resolve}"
            >
              ${confirmLabel}
            </button>
          </div>
        </div>
      `,
      shadow,
    );
    adoptShadowStyles(shadow);

    dialog.appendChild(host);
    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) resolve();
    });
  });
}
