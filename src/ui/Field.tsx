import type { ReactNode } from "react";

export function Field({ label, children }: { label: ReactNode; children?: ReactNode | undefined }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
