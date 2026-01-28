import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels: Record<string, string> = {
  import: 'Import',
  database: 'Base de données',
  charts: 'Graphiques',
  description: 'Description',
  processing: 'Prétraitement',
  versions: 'Versions',
  training: 'Entraînement',
  predict: 'Prédiction',
  results: 'Résultats',
};

export function ProjectBreadcrumb() {
  const { id } = useParams();
  const location = useLocation();
  
  const pathParts = location.pathname.split('/').filter(Boolean);
  const projectIndex = pathParts.indexOf('projects');
  const relevantParts = pathParts.slice(projectIndex + 2);

  if (relevantParts.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-sm mb-4" aria-label="Breadcrumb">
      <Link 
        to="/dashboard" 
        className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Accueil</span>
      </Link>
      
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      
      <Link 
        to={`/projects/${id}/import`} 
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Projet
      </Link>

      {relevantParts.map((part, index) => {
        const isLast = index === relevantParts.length - 1;
        const path = `/projects/${id}/${relevantParts.slice(0, index + 1).join('/')}`;
        const label = routeLabels[part] || part;

        return (
          <div key={part} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link 
                to={path}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default ProjectBreadcrumb;
