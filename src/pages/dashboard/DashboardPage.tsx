import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, FolderOpen, TrendingUp, Target, Plus, Search, Trash2, Lightbulb } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { projectService } from '@/services/projectService';
import { Project, ProjectStats } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { staggerContainer, staggerItem, fadeInUp } from '@/components/ui/page-transition';
import datasetService from "@/services/datasetService";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [openLoadingId, setOpenLoadingId] = useState<string | null>(null);

  const openProject = async (projectId: string) => {
    setOpenLoadingId(projectId);
    try {
      const datasets = await datasetService.list(projectId);
      if (datasets.length > 0) {
        navigate(`/projects/${projectId}/database`);
      } else {
        navigate(`/projects/${projectId}/import`);
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message || "Impossible d’ouvrir le projet",
        variant: "destructive",
      });
    } finally {
      setOpenLoadingId(null);
    }
  };


  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const [projectsData, statsData] = await Promise.all([
          projectService.getProjects(user.id),
          projectService.getStats(user.id),
        ]);
        setProjects(projectsData);
        setStats(statsData);
      } catch (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handleDelete = async () => {
    if (!deleteProject) return;
    try {
      await projectService.deleteProject(deleteProject.id);
      setProjects(projects.filter(p => p.id !== deleteProject.id));
      toast({ title: 'Projet supprimé' });
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
    setDeleteProject(null);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <motion.div 
        className="space-y-8"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Votre espace médical</h1>
            <p className="text-muted-foreground mt-1">Bienvenue, {user?.fullName}</p>
          </div>
          <Button onClick={() => navigate('/projects/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Projet
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Projets actifs" value={stats.activeProjects} icon={FolderOpen} />
            <StatCard 
              title="Précision moyenne IA" 
              value={`${stats.averageAccuracy.toFixed(1)}%`} 
              icon={Target}
              iconClassName="bg-success/10"
            />
            <StatCard 
              title="Performance" 
              value={`+${stats.performanceGrowth}%`} 
              icon={TrendingUp}
              trend={{ value: stats.performanceGrowth, isPositive: true }}
            />
            <StatCard title="Prédictions totales" value={stats.totalPredictions.toLocaleString()} icon={Activity} />
          </motion.div>
        )}

        {/* AI Tip */}
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Conseil IA du jour</p>
              <p className="text-sm text-muted-foreground">
                Utilisez la validation croisée K-Fold pour obtenir des estimations plus robustes de la performance de vos modèles.
              </p>
            </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Projects */}
        <motion.div variants={staggerItem}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Vos projets</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, type: 'spring', stiffness: 260, damping: 20 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer group h-full">
                  <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status === 'active' ? 'Actif' : 'Terminé'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                  {project.accuracy && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-success rounded-full"
                          style={{ width: `${project.accuracy}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{project.accuracy}%</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => openProject(project.id)}
                      disabled={openLoadingId === project.id}
                    >
                      {openLoadingId === project.id ? "Ouverture..." : "Ouvrir"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setDeleteProject(project); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal
        isOpen={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDelete}
        title="Supprimer le projet"
        description={`Êtes-vous sûr de vouloir supprimer "${deleteProject?.name}" ?`}
        variant="destructive"
        confirmText="Supprimer"
      />
    </AppLayout>
  );
}

export default DashboardPage;
