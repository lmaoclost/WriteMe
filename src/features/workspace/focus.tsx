import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2 } from "lucide-react";

export interface FocusValue {
  focus: boolean;
  toggle: () => void;
  exit: () => void;
}

/** Focus state lives in WorkspaceLayout; null outside the workspace. */
export const FocusContext = createContext<FocusValue | null>(null);

/** Writing routes only: manuscript, bindery/:id, wellspring/:id.
 *  The index lists (bindery, wellspring) are not writing surfaces. */
export function isWritingPath(pathname: string): boolean {
  const rest = pathname.match(/^\/p\/[^/]+\/(.+)$/)?.[1] ?? "";
  if (rest === "manuscript") return true;
  return /^bindery\/[^/]+$/.test(rest) || /^wellspring\/[^/]+$/.test(rest);
}

/** Page-level toggle for focus mode; renders null outside FocusContext. */
export function FocusToggle() {
  const { t } = useTranslation();
  const ctx = useContext(FocusContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      aria-pressed={ctx.focus}
      title={t("workspace.focus.tip")}
      className="flex items-center gap-1.5 cursor-pointer bg-none border-0 px-2 py-1.5 text-xs uppercase tracking-[0.1em] text-slate hover:text-parchment aria-pressed:text-gold"
      onClick={ctx.toggle}
    >
      {ctx.focus
        ? <Minimize2 aria-hidden className="size-3.5 flex-none" />
        : <Maximize2 aria-hidden className="size-3.5 flex-none" />}
      {ctx.focus ? t("workspace.focus.exit") : t("workspace.focus.toggle")}
    </button>
  );
}
