import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon, Brain, Rocket,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { imagingService } from "@/services/imagingService";
import type { ImagingConfig } from "@/types/imaging";
import { DEFAULT_IMAGING_CONFIG } from "@/types/imaging";
import { ImagingStep1DataSource } from "./ImagingStep1DataSource";
import { ImagingStep2Architecture } from "./ImagingStep2Architecture";
import { ImagingStep3Summary } from "./ImagingStep3Summary";

const STEPS = [
  { label: "Images", icon: <ImageIcon className="h-4 w-4" /> },
  { label: "Architecture", icon: <Brain className="h-4 w-4" /> },
  { label: "Lancer", icon: <Rocket className="h-4 w-4" /> },
];

interface Props {
  projectId: string | number;
  onBack: () => void;
}

export function ImagingWizardContainer({ projectId, onBack }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ImagingConfig>({ ...DEFAULT_IMAGING_CONFIG });
  const [step1Valid, setStep1Valid] = useState(false);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [launching, setLaunching] = useState(false);

  const handleConfigChange = useCallback((update: Partial<ImagingConfig>) => {
    setConfig((prev) => ({ ...prev, ...update }));
  }, []);

  const handleStep1Change = useCallback(
    (valid: boolean, classes: string[]) => {
      setStep1Valid(valid);
      setClassNames(classes);
      // Re-fetch total (approximation)
      imagingService.listImages(projectId).then((res) => {
        setTotalImages(res.total_images);
      }).catch(() => {});
    },
    [projectId]
  );

  const canAdvance = () => {
    if (step === 0) return step1Valid;
    if (step === 1) return config.models.length > 0;
    return true;
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const fullConfig: ImagingConfig = {
        ...config,
        // class_names et num_classes sont auto-détectés côté backend
      };
      const session = await imagingService.startSession(projectId, fullConfig);
      toast({
        title: "Entraînement lancé",
        description: `Session #${session.id} — ${config.models.length} modèle(s) en cours.`,
      });
      navigate(`/projects/${projectId}/imaging/results/${session.id}`);
    } catch (err: any) {
      toast({
        title: "Erreur au lancement",
        description: err?.message ?? "Impossible de démarrer la session.",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Button>
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.icon}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 && (
            <ImagingStep1DataSource
              projectId={projectId}
              onValidChange={handleStep1Change}
            />
          )}
          {step === 1 && (
            <ImagingStep2Architecture
              config={config}
              onChange={handleConfigChange}
            />
          )}
          {step === 2 && (
            <ImagingStep3Summary
              config={config}
              classNames={classNames}
              totalImages={totalImages}
              onLaunch={handleLaunch}
              launching={launching}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>

        {step < STEPS.length - 1 && (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
