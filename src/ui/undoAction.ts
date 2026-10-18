import { useScriptorium } from "../data/store";
import type { ToastAction } from "../data/store";

/**
 * Toast action that restores the last undoable entity delete. The nonce is
 * captured when the toast is created: if another delete overwrote the slot
 * before this toast's Undo is clicked, the run no-ops with visible feedback
 * instead of undoing the wrong entity.
 */
export function undoToastAction(): ToastAction {
  const nonce = useScriptorium.getState().undoNonce;
  return {
    label: "Undo",
    run: () => {
      const s = useScriptorium.getState();
      if (!s.undoDelete(nonce)) s.pushToast("info", "Nothing left to undo.");
    },
  };
}
