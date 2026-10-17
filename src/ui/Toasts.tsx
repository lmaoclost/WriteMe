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
    <div className="toasts fixed bottom-[18px] right-[18px] z-60 flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={"toast flex items-center gap-2.5 rounded-sm border border-line border-l-[3px] bg-panel py-2.5 pr-3 pl-3 " + (t.kind === "error" ? "border-l-destructive" : t.kind === "success" ? "border-l-success" : "border-l-gold")}
          data-kind={t.kind}
        >
          <span className="toast-message">{t.message}</span>
          <button className="toast-dismiss border-0 bg-transparent text-xs text-slate hover:text-parchment" onClick={() => dismiss(t.id)} aria-label="Dispensar">✕</button>
        </div>
      ))}
    </div>
  );
}
