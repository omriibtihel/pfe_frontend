import { Link, useParams, useLocation } from 'react-router-dom';
import { 
  ChevronRight, 
  ChevronLeft,
  Upload,
  Database,
  BarChart3,
  Settings2,
  GitBranch,
  Brain,
  Target,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const pageFlow = [
  { path: 'import', label: 'Import', icon: Upload },
  { path: 'database', label: 'Base de données', icon: Database },
  { path: 'description', label: 'Description', icon: FileText },
  { path: 'charts', label: 'Graphiques', icon: BarChart3 },
  { path: 'processing', label: 'Prétraitement', icon: Settings2 },
  { path: 'versions', label: 'Versions', icon: GitBranch },
  { path: 'training', label: 'Entraînement', icon: Brain },
  { path: 'predict', label: 'Prédiction', icon: Target },
];

interface QuickActionsProps {
  showCard?: boolean;
  message?: string;
  description?: string;
}

export function QuickActions({ showCard = true, message, description }: QuickActionsProps) {
  const { id } = useParams();
  const location = useLocation();
  
  const currentPath = location.pathname.split('/').filter(Boolean);
  const currentPage = currentPath[currentPath.length - 1];
  
  // Handle results pages
  const baseCurrentPage = currentPage === 'results' 
    ? currentPath[currentPath.length - 2] 
    : currentPage;
  
  const currentIndex = pageFlow.findIndex(p => p.path === baseCurrentPage);
  
  const prevPage = currentIndex > 0 ? pageFlow[currentIndex - 1] : null;
  const nextPage = currentIndex < pageFlow.length - 1 ? pageFlow[currentIndex + 1] : null;

  const content = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        {message && <p className="font-medium">{message}</p>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex gap-2">
        {prevPage && (
          <Button variant="outline" asChild>
            <Link to={`/projects/${id}/${prevPage.path}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {prevPage.label}
            </Link>
          </Button>
        )}
        {nextPage && (
          <Button asChild className="bg-gradient-to-r from-primary to-secondary">
            <Link to={`/projects/${id}/${nextPage.path}`}>
              {nextPage.label}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );

  if (!showCard) return content;

  return (
    <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5">
      <CardContent className="py-4">
        {content}
      </CardContent>
    </Card>
  );
}

export default QuickActions;
