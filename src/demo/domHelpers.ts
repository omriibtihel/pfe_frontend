// src/demo/domHelpers.ts
//
// DOM utilities used by the tour engine. Kept framework-agnostic.

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number; // center x
  cy: number; // center y
}

/** Resolves a selector to an element rect in viewport coordinates. */
export function getRect(selector: string): ElementRect | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left,
    y: r.top,
    width: r.width,
    height: r.height,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  };
}

/** Resolve a target with a retry budget — pages may still be mounting. */
export async function waitForElement(
  selector: string,
  timeoutMs = 4000,
): Promise<HTMLElement | null> {
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) return resolve(el);
      if (performance.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * Scrolls an element into view only if it's actually outside the viewport.
 * Avoids unnecessary page pivots that would disorient the viewer.
 */
export function ensureVisible(el: HTMLElement, margin = 80) {
  const r = el.getBoundingClientRect();
  const fullyVisible =
    r.top >= margin &&
    r.left >= 0 &&
    r.bottom <= window.innerHeight - margin &&
    r.right <= window.innerWidth;
  if (!fullyVisible) {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }
}

/**
 * Simulates a real user typing into an input. Updates the value
 * and dispatches the events React expects (input + change).
 */
export async function typeInto(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  perCharMs = 60,
) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    "value",
  )?.set;

  el.focus();
  // Clear current value
  nativeSetter?.call(el, "");
  el.dispatchEvent(new Event("input", { bubbles: true }));

  let current = "";
  for (const char of text) {
    current += char;
    nativeSetter?.call(el, current);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(perCharMs);
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Simulates a file being dropped into an `<input type="file">`.
 * Uses the DataTransfer trick to bypass the read-only `files` property.
 */
export function dispatchFileUpload(
  inputSelector: string,
  file: { name: string; content: string; type: string },
) {
  const input = document.querySelector(inputSelector) as HTMLInputElement | null;
  if (!input) return false;
  const fileObj = new File([file.content], file.name, { type: file.type });
  const dt = new DataTransfer();
  dt.items.add(fileObj);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Dispatches a realistic user click. A bare `el.click()` only fires the
 * `click` event, which is enough for plain `onClick` handlers but is missed
 * by Radix UI primitives (Tabs, Dialog, DropdownMenu, etc.) that listen on
 * `pointerdown` / `mousedown`. We dispatch the full pointer lifecycle so
 * any handler attached anywhere along the bubble path will fire — then call
 * the native `.click()` as a belt-and-suspenders fallback.
 *
 * If the data-tour element happens to wrap the actual interactive element,
 * we also forward the click to the nearest enabled descendant <button>.
 */
export function simulateClick(el: HTMLElement) {
  // Some `data-tour` anchors are wrappers (e.g. a Card containing a button).
  // Resolve to the most likely interactive target.
  const target = resolveInteractiveTarget(el);
  if (target.hasAttribute("disabled")) {
    // Don't try to click a disabled element — it would be a no-op anyway,
    // and dispatching events still risks creating focus/hover state that
    // confuses subsequent steps. Log so the dev can spot the misroute.
    console.warn("[demo] simulateClick skipped: target is disabled", target);
    return;
  }

  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const baseInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: 1,
  };
  const pointerInit: PointerEventInit = {
    ...baseInit,
    pointerType: "mouse",
    pointerId: 1,
    isPrimary: true,
  };

  try {
    target.dispatchEvent(new PointerEvent("pointerover", pointerInit));
    target.dispatchEvent(new PointerEvent("pointerenter", pointerInit));
    target.dispatchEvent(new MouseEvent("mouseover", baseInit));
    target.dispatchEvent(new MouseEvent("mouseenter", baseInit));
    target.dispatchEvent(new PointerEvent("pointerdown", pointerInit));
    target.dispatchEvent(new MouseEvent("mousedown", baseInit));
    target.focus?.();
    target.dispatchEvent(new PointerEvent("pointerup", { ...pointerInit, buttons: 0 }));
    target.dispatchEvent(new MouseEvent("mouseup", { ...baseInit, buttons: 0 }));
    target.dispatchEvent(new MouseEvent("click", { ...baseInit, buttons: 0 }));
  } catch (e) {
    console.warn("[demo] event dispatch failed", e);
  }

  // Final fallback: trigger the native click handler. This is what fires for
  // plain React onClick={...} props and also for some browsers' default
  // button behavior (e.g. submitting a form).
  try {
    target.click?.();
  } catch (e) {
    console.warn("[demo] native click failed", e);
  }
}

function resolveInteractiveTarget(el: HTMLElement): HTMLElement {
  // The element itself is a button, link, or input — use it directly.
  if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName)) return el;
  if (el.getAttribute("role") === "button" || el.getAttribute("role") === "tab" || el.getAttribute("role") === "checkbox") return el;
  // Otherwise try the first interactive descendant.
  const inner = el.querySelector<HTMLElement>(
    'button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"]), [role="tab"]:not([aria-disabled="true"])',
  );
  return inner ?? el;
}
