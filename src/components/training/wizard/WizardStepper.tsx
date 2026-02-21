import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  icon: React.ReactNode;
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps: Set<number>;
}

export function WizardStepper({ steps, currentStep, onStepClick, completedSteps }: WizardStepperProps) {
  return (
    <div className="relative">
      {/* Progress line */}
      <div className="absolute top-6 left-0 right-0 h-0.5 bg-border mx-12" />
      <motion.div
        className="absolute top-6 left-0 h-0.5 bg-primary mx-12"
        initial={{ width: 0 }}
        animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{ maxWidth: 'calc(100% - 6rem)' }}
      />

      <div className="relative flex justify-between">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.has(i);
          const isCurrent = i === currentStep;
          const isAccessible = isCompleted || i <= currentStep;

          return (
            <button
              key={i}
              onClick={() => isAccessible && onStepClick(i)}
              disabled={!isAccessible}
              className={cn(
                'flex flex-col items-center gap-2 group transition-all duration-200',
                isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
              )}
            >
              <motion.div
                className={cn(
                  'relative z-10 flex items-center justify-center w-12 h-12 rounded-2xl border-2 transition-all duration-300',
                  isCurrent && 'border-primary bg-primary text-primary-foreground shadow-glow-sm scale-110',
                  isCompleted && !isCurrent && 'border-primary bg-primary/10 text-primary',
                  !isCurrent && !isCompleted && 'border-border bg-card text-muted-foreground'
                )}
                whileHover={isAccessible ? { scale: 1.1 } : undefined}
                whileTap={isAccessible ? { scale: 0.95 } : undefined}
              >
                {isCompleted && !isCurrent ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.icon
                )}
              </motion.div>
              <span className={cn(
                'text-xs font-medium transition-colors max-w-[80px] text-center leading-tight',
                isCurrent ? 'text-primary' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
