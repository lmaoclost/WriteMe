import type { ReactNode } from "react";

/** Field block: label eyebrow + children. Uses a div, not a <label>: several
 *  Fields wrap buttons/pickers and a label would steal the accessible name of
 *  the first labelable descendant. Inputs inside all carry their own aria-label. */
export function Field({ label, children }: { label: ReactNode; children?: ReactNode | undefined }) {
  return (
    <div className="field flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}