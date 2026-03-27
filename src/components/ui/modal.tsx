import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Override the default onOpenChange handler (e.g. for custom back/close logic). */
  onOpenChange?: (open: boolean) => void;
  title?: ReactNode;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: ModalSize;
  /** Icon displayed in a badge to the left of the title. */
  icon?: ReactNode;
  /** Prevent the dialog from closing when the user clicks the backdrop. */
  preventCloseOnOutside?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm:    "sm:max-w-sm",
  md:    "sm:max-w-md",
  lg:    "sm:max-w-lg",
  xl:    "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export function Modal({
  isOpen,
  onClose,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
  icon,
  preventCloseOnOutside = false,
}: ModalProps) {
  const handleOpenChange = onOpenChange ?? ((open: boolean) => { if (!open) onClose(); });

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        onInteractOutside={preventCloseOnOutside ? (e) => e.preventDefault() : undefined}
        className={cn(
          // sizing
          "w-[calc(100vw-1.5rem)] sm:w-full",
          sizeClasses[size],
          "max-h-[calc(100vh-1.5rem)]",
          // layout
          "overflow-hidden flex flex-col",
          "p-0 rounded-2xl",
          // background — pure white in light, deep card in dark
          "bg-white dark:bg-[hsl(222,36%,10%)]",
          // border
          "border border-border/50 dark:border-white/[0.07]",
          // elevation
          "shadow-[0_20px_60px_-15px_hsl(0,0%,0%,0.15),0_8px_24px_-8px_hsl(0,0%,0%,0.08)]",
          "dark:shadow-[0_24px_64px_-12px_hsl(0,0%,0%,0.65),0_0_0_1px_hsl(var(--primary)/0.08)]",
          className,
        )}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        {(title || description) && (
          <DialogHeader
            className={cn(
              "relative px-6 pt-5 pb-4 shrink-0",
              "border-b border-border/30 dark:border-white/[0.06]",
              "bg-gradient-to-b from-primary/[0.035] to-transparent",
              "dark:from-primary/[0.07] dark:to-transparent",
              "overflow-hidden",
            )}
          >
            {/* Top accent bar */}
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-secondary to-accent" />

            <div className={cn("flex items-center gap-3.5", icon ? "mt-0.5" : "")}>
              {icon && (
                <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 dark:bg-primary/20 text-primary ring-4 ring-primary/10 dark:ring-primary/15">
                  {icon}
                </div>
              )}

              <div className="flex-1 min-w-0 pr-8">
                {title && (
                  <DialogTitle className="text-[15px] font-bold leading-tight tracking-tight text-foreground">
                    {title}
                  </DialogTitle>
                )}
                {/* Always rendered to satisfy Radix accessibility requirement; sr-only when empty */}
                <DialogDescription className={description ? "mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground/80" : "sr-only"}>
                  {description ?? ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        )}

        {/* ── Scrollable body ─────────────────────────────────────── */}
        {children != null && (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 scrollbar-modern">
            {children}
          </div>
        )}

        {/* ── Optional footer ─────────────────────────────────────── */}
        {footer && (
          <div className={cn(
            "shrink-0 px-6 py-4",
            "border-t border-border/30 dark:border-white/[0.06]",
            "bg-muted/30 dark:bg-white/[0.02]",
          )}>
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmModal
// ─────────────────────────────────────────────────────────────────────────────

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
  icon?: ReactNode;
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
  icon,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      icon={icon}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            size="sm"
            variant={variant}
            onClick={onConfirm}
            disabled={isLoading}
            className="min-w-[90px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Traitement…
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      }
    />
  );
}

export default Modal;
