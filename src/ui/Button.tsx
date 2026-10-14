import type { ButtonHTMLAttributes } from "react";

export function Button({ kind = "primary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "danger" }) {
  const cls = kind === "primary" ? "btn-primary" : kind === "danger" ? "btn-danger" : "btn-ghost";
  return <button type="button" className={`${cls} ${className}`} {...rest} />;
}
