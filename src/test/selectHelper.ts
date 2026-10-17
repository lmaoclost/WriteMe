import { act, waitFor } from "@testing-library/react";
import { expect } from "vitest";

// Opens a radix-based shadcn Select from its trigger and picks an option
// by accessible name. Works under jsdom (no pointer events required).
export async function selectOption(
  getTrigger: () => HTMLElement,
  optionName: string | RegExp
) {
  const trigger = getTrigger();
  fireEventOpen(trigger);
  await waitFor(() => {
    const content = document.querySelector("[data-slot='select-content']");
    if (!content) throw new Error("select content not open");
  });
  const option = waitFor(() => {
    const el = Array.from(document.querySelectorAll("[data-slot='select-content'] [role='option']")).find(
      (o) =>
        typeof optionName === "string"
          ? (o.textContent ?? "").trim() === optionName
          : optionName.test(o.textContent ?? "")
    );
    if (!el) throw new Error("option not found");
    return el as HTMLElement;
  });
  const chosen = await option;
  chooseOption(chosen);
  await waitFor(() => expect(document.querySelector("[data-slot='select-content']")).not.toBeInTheDocument());
  return trigger;
}

function fireEventOpen(trigger: HTMLElement) {
  // radix opens the listbox on keydown/pointer; keydown is jsdom-safe
  const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
  act(() => { trigger.dispatchEvent(ev); });
}

function chooseOption(option: HTMLElement) {
  // radix SelectItem commits on pointerup; dispatch the raw sequence
  for (const type of ["pointerdown", "pointerup"] as const) {
    const ev = new Event(type, { bubbles: true, cancelable: true }) as
      Event & { pointerType: string; button: number };
    ev.pointerType = "mouse";
    ev.button = 0;
    act(() => { option.dispatchEvent(ev); });
  }
}
