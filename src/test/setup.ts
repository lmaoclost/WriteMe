import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks layout APIs used by radix primitives
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!(HTMLElement.prototype as HTMLElement & { hasPointerCapture?: boolean }).hasPointerCapture) {
  (HTMLElement.prototype as HTMLElement & { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

afterEach(cleanup);
