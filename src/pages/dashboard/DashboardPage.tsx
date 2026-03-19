import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Clock3,
  FolderOpen,
  Layers,
  Lightbulb,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { projectService } from "@/services/projectService";
import type { Project } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem, fadeInUp } from "@/components/ui/page-transition";
import datasetService from "@/services/datasetService";

const AI_TIPS = [
  "La validation croisée K-Fold donne une estimation plus fiable de la généralisation que le simple holdout.",
  "Normalisez toujours vos features numériques avant d'entraîner un SVM ou un réseau de neurones.",
  "Un dataset déséquilibré peut fausser vos métriques — vérifiez le F1-score en plus de l'accuracy.",
  "SMOTE génère des exemples synthétiques de la classe minoritaire plutôt que de simplement dupliquer.",
  "L'importance des features (Random Forest) aide à identifier les variables redondantes avant le training.",
  "Un modèle simple bien calibré surpasse souvent un modèle complexe sur-ajusté.",
  "Consultez toujours la matrice de confusion : l'accuracy seule cache les faux négatifs critiques en médecine.",
  "Le GridSearch exhaustif peut être remplacé par RandomSearch pour gagner 80% du gain en 20% du temps.",
  "Séparez vos données en train/validation/test dès le début — ne touchez au test qu'une seule fois.",
  "LightGBM et XGBoost convergent souvent plus vite que Random Forest sur des données tabulaires médicales.",
];

function getDailyTip(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  return AI_TIPS[dayOfYear % AI_TIPS.length];
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [openLoadingId, setOpenLoadingId] = useState<string | null>(null);

  const dailyTip = useMemo(() => getDailyTip(), []);

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
        const projectsData = await projectService.getProjects(user.id);
        setProjects(projectsData);
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

  const now = Date.now();
  const thisMonthCount = projects.filter((p) => {
    const d = new Date(p.createdAt).getTime();
    return now - d < 30 * 86_400_000;
  }).length;

  const lastUpdated = projects.reduce<Project | null>((latest, p) => {
    if (!latest) return p;
    return new Date(p.updatedAt) > new Date(latest.updatedAt) ? p : latest;
  }, null);

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

        <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total projets */}
          <div className="ai-surface flex items-center gap-4 rounded-2xl bg-card/75 p-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total projets</p>
              <p className="text-3xl font-bold tracking-tight">{projects.length}</p>
            </div>
          </div>

          {/* Créés ce mois */}
          <div className="ai-surface flex items-center gap-4 rounded-2xl bg-card/75 p-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-secondary/15">
              <CalendarDays className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Créés ce mois</p>
              <p className="text-3xl font-bold tracking-tight">{thisMonthCount}</p>
              <p className="text-xs text-muted-foreground">sur les 30 derniers jours</p>
            </div>
          </div>

          {/* Dernière activité */}
          <div className="ai-surface flex items-center gap-4 rounded-2xl bg-card/75 p-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent/15">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Dernière activité</p>
              {lastUpdated ? (
                <>
                  <p className="truncate text-sm font-bold">{lastUpdated.name}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(lastUpdated.updatedAt)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="ai-surface border-primary/25 bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent">
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Conseil IA du jour</p>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{dailyTip}</p>
              </div>
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
                      <div className="flex flex-col items-end gap-1">
                        {project.id === lastUpdated?.id && (
                          <Badge variant="outline" className="border-accent/50 text-accent text-[10px]">
                            Récent
                          </Badge>
                        )}
                        {thisMonthCount > 0 && new Date(project.createdAt).getTime() > now - 30 * 86_400_000 && project.id !== lastUpdated?.id && (
                          <Badge variant="outline" className="border-secondary/50 text-secondary text-[10px]">
                            Nouveau
                          </Badge>
                        )}
                      </div>
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

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      <span>{timeAgo(project.updatedAt)}</span>
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
