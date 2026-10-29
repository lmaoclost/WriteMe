// jsdom has no PointerEvent; RTL's fallback drops all init keys. Dispatch a
// real-ish pointer event manually with the fields handlers read.
import { act } from "@testing-library/react";

export interface PointerInit {
  clientX: number;
  clientY: number;
  button?: number;
  pointerId?: number;
  pointerType?: string;
}

export function firePointer(el: HTMLElement, type: string, init: PointerInit) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    button: { value: init.button ?? 0 },
    buttons: { value: type.endsWith("up") || type.endsWith("cancel") ? 0 : 1 },
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? "mouse" },
    // dnd-kit's PointerSensor only follows primary pointers
    isPrimary: { value: true },
  });
  act(() => {
    el.dispatchEvent(e);
  });
}
