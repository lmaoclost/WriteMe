import type { ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function Modal({
  title,
  onClose,
  children,
  closeLabel = "Fechar",
}: {
  title: ReactNode;
  onClose: () => void;
  children?: ReactNode | undefined;
  closeLabel?: string;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(440px,92vw)] rounded-lg bg-card p-4.5 sm:max-w-[min(440px,92vw)]">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogClose
            aria-label={closeLabel}
            className="border-0 bg-transparent text-sm text-slate hover:text-parchment"
          >
            ✕
          </DialogClose>
        </DialogHeader>
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
