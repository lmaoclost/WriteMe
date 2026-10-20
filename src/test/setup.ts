import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { flushPendingPersist } from "../data/storage";
import { setLanguage } from "../i18n";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks layout APIs used by radix primitives
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!(HTMLElement.prototype as HTMLElement & { hasPointerCapture?: boolean }).hasPointerCapture) {
  (HTMLElement.prototype as HTMLElement & { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

beforeEach(async () => {
  // English is the baseline for the existing suite; language tests opt in to PT.
  await setLanguage("en");
  // fresh IndexedDB island per test: imageStore caches its connection per
  // factory instance, so a swap below gives every test an empty durable store
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
  // drain coalesced persist writes so no test's queued payload fires
  // mid-way through a later test's async awaits
  flushPendingPersist();
});
