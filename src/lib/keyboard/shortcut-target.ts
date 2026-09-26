const interactive = 'input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], [data-shortcuts="off"]';
const overlays = '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"], dialog[open]';

/** Preserve native text editing, control keys, and Radix modal/portal interactions. */
export function shortcutTargetBlocked(event: KeyboardEvent, document: Document): boolean {
  if (document.visibilityState === "hidden") return true;
  if (event.composedPath().some((target) => target instanceof Element && target.closest(interactive))) return true;
  const focused = document.activeElement;
  if (focused?.closest(interactive)) return true;
  return Array.from(document.querySelectorAll<HTMLElement>(overlays)).some((element) =>
    !element.closest('[hidden], [inert], [aria-hidden="true"], [data-state="closed"]') && element.getClientRects().length > 0);
}
