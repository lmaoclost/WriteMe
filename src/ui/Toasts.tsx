import { useEffect, useRef } from "react";
import { useScriptorium, type ToastKind } from "../data/store";

export const toastKindAttr = (kind: ToastKind): string => `[data-kind="${kind}"]`;

export function Toasts() {
  const toasts = useScriptorium((s) => s.toasts);
  const dismiss = useScriptorium((s) => s.dismissToast);
  // one timer per NEW toast: keying the effect on the whole array restarted
  // every timer whenever any toast arrived, so toasts arriving within 4s of
  // each other never expired
  const scheduledRef = useRef(new Set<string>());
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const t of toasts) {
      if (scheduledRef.current.has(t.id)) continue;
      scheduledRef.current.add(t.id);
      timers.push(setTimeout(() => dismiss(t.id), 4000));
    }
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
