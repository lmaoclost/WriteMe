import { useScriptorium } from "../data/store";
import type { ToastAction } from "../data/store";

/** Toast action that restores the last undoable entity delete. */
export function undoToastAction(): ToastAction {
  return {
    label: "Undo",
    run: () => { useScriptorium.getState().undoDelete(); },
  };
}