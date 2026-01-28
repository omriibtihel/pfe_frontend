import { useLocation, useParams, Link } from 'react-router-dom';
import { 
  Upload, 
  Database, 
  BarChart3, 
  Settings2, 
  GitBranch, 
  Brain, 
  Target,
  Check,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { path: 'import', icon: Upload, label: 'Import', description: 'Charger les données' },
  { path: 'database', icon: Database, label: 'Explorer', description: 'Visualiser le dataset' },
  { path: 'processing', icon: Settings2, label: 'Traiter', description: 'Nettoyer et transformer' },
  { path: 'versions', icon: GitBranch, label: 'Versions', description: 'Gérer les sauvegardes' },
  { path: 'training', icon: Brain, label: 'Entraîner', description: 'Configurer le modèle' },
  { path: 'predict', icon: Target, label: 'Prédire', description: 'Faire des prédictions' },
];

interface ProjectStepIndicatorProps {
  variant?: 'full' | 'compact';
  className?: string;
}

export function ProjectStepIndicator({ variant = 'compact', className }: ProjectStepIndicatorProps) {
  const { id } = useParams();
  const location = useLocation();
  
  const currentPath = location.pathname.split('/').pop() || '';
  const currentIndex = steps.findIndex(s => currentPath.includes(s.path));

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-1 overflow-x-auto pb-2", className)}>
        {steps.map((step, index) => {
          const isActive = currentPath.includes(step.path);
          const isPast = index < currentIndex;
          
          return (
            <div key={step.path} className="flex items-center">
              <Link
                to={`/projects/${id}/${step.path}`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all whitespace-nowrap",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : isPast
                      ? "bg-success/10 text-success hover:bg-success/20"
                      : "text-muted-foreground hover:bg-muted"
                )}
              >
                {isPast ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <step.icon className="h-3.5 w-3.5" />
                )}
                <span>{step.label}</span>
              </Link>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {steps.map((step, index) => {
        const isActive = currentPath.includes(step.path);
        const isPast = index < currentIndex;
        
        return (
          <Link
            key={step.path}
            to={`/projects/${id}/${step.path}`}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-all",
              isActive 
                ? "bg-primary text-primary-foreground" 
                : isPast
                  ? "bg-success/10 text-success hover:bg-success/20"
                  : "hover:bg-muted"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              isActive 
                ? "bg-primary-foreground/20" 
                : isPast
                  ? "bg-success/20"
                  : "bg-muted"
            )}>
              {isPast ? (
                <Check className="h-4 w-4" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{step.label}</p>
              <p className={cn(
                "text-xs truncate",
                isActive ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {step.description}
              </p>
            </div>
            <step.icon className="h-5 w-5 flex-shrink-0 opacity-50" />
          </Link>
        );
      })}
    </div>
  );
}

export default ProjectStepIndicator;
