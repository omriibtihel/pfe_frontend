/**
 * MedHelp — Composant d'aide contextuelle pour professionnels de santé.
 * Affiche une icône ℹ cliquable ouvrant une bulle d'information en langage clair.
 * Conçu pour les utilisateurs non-techniciens (médecins, infirmiers, radiologues).
 */
import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MedHelpProps {
  /** Titre court affiché en gras dans la bulle */
  title: string;
  /** Contenu de l'explication — peut être du texte ou du JSX */
  children: React.ReactNode;
  /** Côté d'ouverture de la bulle (défaut : top) */
  side?: "top" | "bottom" | "left" | "right";
  /** Classe CSS supplémentaire sur l'icône */
  className?: string;
}

export function MedHelp({ title, children, side = "top", className }: MedHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground/60 hover:text-sky-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label={`Aide : ${title}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} className="w-80 space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * MedRange — Affiche une barre colorée d'interprétation d'une métrique.
 * Ex: "Acceptable 0.70 | Bon 0.80 | Excellent 0.90+"
 */
interface MedRangeProps {
  ranges: Array<{ label: string; color: string; threshold: string }>;
}

export function MedRange({ ranges }: MedRangeProps) {
  return (
    <div className="flex gap-1 flex-wrap pt-1">
      {ranges.map((r) => (
        <span
          key={r.label}
          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", r.color)}
        >
          {r.label} {r.threshold}
        </span>
      ))}
    </div>
  );
}
