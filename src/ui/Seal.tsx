import { cn } from "@/lib/utils";

export function Seal({ letter = "S", className }: { letter?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "seal",
        "bg-[radial-gradient(circle_at_32%_30%,var(--seal-wax),var(--seal-mid)_62%,var(--seal-deep))]",
        "text-[var(--seal-engrave)]",
        "shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_2px_6px_var(--scrim-canvas)]",
        className
      )}
    >
      {letter}
    </span>
  );
}