import type { ReactNode } from "react";

/** Field block: label eyebrow + children. div, not <label> — several Fields
 *  wrap buttons/pickers; inputs carry their own aria-label. The arbitrary
 *  descendant utilities replicate the old .field input/textarea rules
 *  (ui.css is gone). */
export function Field({ label, children }: { label: ReactNode; children?: ReactNode | undefined }) {
  return (
    <div
      className={
        "field flex flex-col gap-1.5 " +
        "[&_input]:w-full [&_textarea]:w-full [&_input]:rounded-sm [&_textarea]:rounded-sm " +
        "[&_input]:border [&_textarea]:border [&_input]:border-line [&_textarea]:border-line " +
        "[&_input]:bg-ink [&_textarea]:bg-ink [&_input]:px-2.5 [&_input]:py-2 [&_textarea]:px-2.5 [&_textarea]:py-2 " +
        "[&_input]:text-[15px] [&_textarea]:text-[15px] [&_input]:text-parchment [&_textarea]:text-parchment " +
        "[&_input]:outline-none [&_textarea]:outline-none [&_input]:font-[inherit] [&_textarea]:font-[inherit] " +
        "[&_input:focus-visible]:border-gold-dim [&_textarea:focus-visible]:border-gold-dim"
      }
    >
      <span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{label}</span>
      {children}
    </div>
  );
}
