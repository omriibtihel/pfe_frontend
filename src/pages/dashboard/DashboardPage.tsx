import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  FolderOpen,
  Lightbulb,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Sparkles,
  Clock3,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { projectService } from "@/services/projectService";
import { Project, ProjectStats } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem, fadeInUp } from "@/components/ui/page-transition";
import datasetService from "@/services/datasetService";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [openLoadingId, setOpenLoadingId] = useState<string | null>(null);

  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const openProject = async (projectId: string) => {
    setOpenLoadingId(projectId);
    try {
      const datasets = await datasetService.list(projectId);
      if (datasets.length > 0) {
        navigate(`/projects/${projectId}/database`);
      } else {
        navigate(`/projects/${projectId}/import`);
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: (error as Error).message || "Impossible d'ouvrir le projet",
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
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de charger les donnees",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  const handleDelete = async () => {
    if (!deleteProject) return;

    try {
      await projectService.deleteProject(deleteProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteProject.id));
      toast({ title: "Projet supprime" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }

    setDeleteProject(null);
  };

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div className="space-y-8" initial="initial" animate="animate" variants={staggerContainer}>
        <motion.section variants={staggerItem} className="ai-surface-strong relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -left-16 top-6 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-14 bottom-2 h-36 w-36 rounded-full bg-secondary/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <span className="ai-chip">
                <Sparkles className="h-3.5 w-3.5" />
                AI Command Center
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Votre espace medical intelligent</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Pilotez vos projets, vos datasets et vos modeles depuis une interface unique orientee IA.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {dayLabel}
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button variant="outline" className="gap-2" onClick={() => navigate("/projects")}>
                <FolderOpen className="h-4 w-4" />
                Voir les projets
              </Button>
              <Button className="gap-2" onClick={() => navigate("/projects/new")}>
                <Plus className="h-4 w-4" />
                Nouveau projet
              </Button>
            </div>
          </div>
        </motion.section>

        {stats && (
          <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Projets actifs"
              value={stats.activeProjects}
              icon={FolderOpen}
              className="ai-surface bg-card/75"
            />
            <StatCard
              title="Precision moyenne"
              value={`${stats.averageAccuracy.toFixed(1)}%`}
              icon={Target}
              className="ai-surface bg-card/75"
              iconClassName="bg-success/15"
            />
            <StatCard
              title="Performance"
              value={`+${stats.performanceGrowth}%`}
              icon={TrendingUp}
              className="ai-surface bg-card/75"
              trend={{ value: stats.performanceGrowth, isPositive: true }}
            />
            <StatCard
              title="Predictions"
              value={stats.totalPredictions.toLocaleString()}
              icon={Activity}
              className="ai-surface bg-card/75"
            />
          </motion.div>
        )}

        <motion.div variants={fadeInUp}>
          <Card className="ai-surface border-primary/25 bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent">
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Conseil IA du jour</p>
                <p className="text-sm text-muted-foreground">
                  Utilisez la validation croisee K-Fold pour estimer plus finement la robustesse de vos modeles.
                </p>
              </div>
              <Button variant="ghost" className="gap-2 self-start sm:self-center">
                En savoir plus
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.section variants={staggerItem} className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Vos projets</h2>
              <p className="text-sm text-muted-foreground">Accedez rapidement a vos espaces de travail IA.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un projet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 border-border/70 bg-card/70 pl-10"
              />
            </div>
          </div>

          {!filteredProjects.length && (
            <Card className="ai-surface border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Aucun projet trouve</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Creez un nouveau projet ou ajustez votre recherche pour afficher vos travaux existants.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card className="ai-surface group h-full overflow-hidden border-border/60 bg-card/80">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-2 text-lg">{project.name}</CardTitle>
                      <Badge variant={project.status === "active" ? "default" : "secondary"}>
                        {project.status === "active" ? "Actif" : "Termine"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {project.description || "Projet IA medical sans description."}
                    </p>

                    {project.accuracy != null && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Precision du modele</span>
                          <span className="font-semibold text-foreground">{project.accuracy}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${project.accuracy}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Mis a jour</span>
                      <span>{new Date(project.updatedAt).toLocaleDateString("fr-FR")}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => openProject(project.id)}
                        disabled={openLoadingId === project.id}
                      >
                        {openLoadingId === project.id ? "Ouverture..." : "Ouvrir"}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteProject(project)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </motion.div>

      <ConfirmModal
        isOpen={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDelete}
        title="Supprimer le projet"
        description={`Voulez-vous supprimer "${deleteProject?.name}" ?`}
        variant="destructive"
        confirmText="Supprimer"
      />
    </AppLayout>
  );
}

export default DashboardPage;
