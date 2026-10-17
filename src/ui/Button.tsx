import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Keep these variant class lists in sync with the .btn-* aliases in ui.css
// (raw <button className="btn-*"> sites in features still style themselves
// from ui.css until phase 2 migrates them to this component).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-2 text-[15px] transition-[filter,border-color,background-color,color] duration-150 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      kind: {
        primary: "bg-gold font-semibold text-wax hover:brightness-[1.08]",
        ghost: "border border-line text-parchment-dim hover:border-gold-dim hover:text-parchment",
        danger: "border border-destructive text-destructive hover:bg-destructive/18",
      },
    },
    defaultVariants: { kind: "primary" },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ kind = "primary", className = "", ...rest }: ButtonProps) {
  return <button type="button" className={cn(buttonVariants({ kind }), className)} {...rest} />;
}