import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { flushPendingPersist } from "../data/storage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks layout APIs used by radix primitives
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!(HTMLElement.prototype as HTMLElement & { hasPointerCapture?: boolean }).hasPointerCapture) {
  (HTMLElement.prototype as HTMLElement & { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

afterEach(() => {
  cleanup();
  // drain coalesced persist writes so no test's queued payload fires
  // mid-way through a later test's async awaits
  flushPendingPersist();
});
