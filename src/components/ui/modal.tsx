import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        className={cn(
          // responsive width
          "w-[calc(100vw-1.25rem)] sm:w-full",
          sizeClasses[size],

          // height & layout
          "max-h-[calc(100vh-1.25rem)]",
          "overflow-hidden flex flex-col",

          // look
          "p-0 rounded-2xl",
          "border border-border/50",
          "bg-background/95 supports-[backdrop-filter]:bg-background/75 backdrop-blur-xl",
          "shadow-dark-elevated",

          className
        )}
      >
        {(title || description) && (
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            {title ? <DialogTitle className="pr-8">{title}</DialogTitle> : null}
            <DialogDescription className={description ? undefined : 'sr-only'}>
              {description ?? title ?? ''}
            </DialogDescription>
          </DialogHeader>
        )}

        {/* Scroll zone */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 scrollbar-modern">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  variant = "default",
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
    >
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? "Chargement..." : confirmText}
        </Button>
      </div>
    </Modal>
  );
}

export default Modal;
