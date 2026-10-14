import { useEffect } from "react";
import { useScriptorium, type ToastKind } from "../data/store";

export const toastKindAttr = (kind: ToastKind): string => `[data-kind="${kind}"]`;

export function Toasts() {
  const toasts = useScriptorium((s) => s.toasts);
  const dismiss = useScriptorium((s) => s.dismissToast);
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 4000));
    return () => { timers.forEach(clearTimeout); };
  }, [toasts, dismiss]);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind}>
          <span className="toast-message">{t.message}</span>
          <button className="toast-dismiss" onClick={() => dismiss(t.id)} aria-label="Dispensar">✕</button>
        </div>
      ))}
    </div>
  );
}