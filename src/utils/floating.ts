import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type Middleware,
  type Placement,
  type Strategy,
} from "@floating-ui/dom";

export interface FloatingOptions {
  placement?: Placement;
  offsetPx?: number;
  padding?: number;
  strategy?: Strategy;
  middleware?: Middleware[];
}

export interface FloatingHandle {
  update: () => void;
  destroy: () => void;
}

/**
 * Anchor a floating element next to a reference element and keep it in place
 * on scroll, resize and layout changes. `flip`/`shift` keep it inside the
 * viewport so callers no longer need their own collision math.
 *
 * The returned handle's `destroy()` must be called when the floating element is
 * removed, otherwise autoUpdate keeps listening forever.
 */
export function positionFloating(
  reference: Element,
  floating: HTMLElement,
  options: FloatingOptions = {},
): FloatingHandle {
  const {
    placement = "top",
    offsetPx = 8,
    padding = 8,
    strategy = "fixed",
    middleware = [],
  } = options;

  floating.style.position = strategy;
  floating.style.left = "0";
  floating.style.top = "0";

  const update = () => {
    void computePosition(reference, floating, {
      placement,
      strategy,
      middleware: [
        offset(offsetPx),
        flip({ padding }),
        shift({ padding }),
        ...middleware,
      ],
    }).then(({ x, y }) => {
      if (!floating.isConnected) return;
      floating.style.left = `${Math.round(x)}px`;
      floating.style.top = `${Math.round(y)}px`;
      floating.style.visibility = "visible";
    });
  };

  const stop = autoUpdate(reference, floating, update, {
    ancestorScroll: true,
    ancestorResize: true,
    elementResize: true,
  });

  return { update, destroy: stop };
}
