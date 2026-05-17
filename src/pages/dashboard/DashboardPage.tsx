import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  ArrowUpRight,
  Brain,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  FolderOpen,
  Layers,
  LayoutGrid,
  Lightbulb,
  List as ListIcon,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileMenu } from "@/components/ProfileMenu";
import { cn } from "@/lib/utils";
import { projectService } from "@/services/projectService";
import type { Project } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem, fadeInUp } from "@/components/ui/page-transition";
import datasetService from "@/services/datasetService";
import { withDemoPrefix } from "@/demo/paths";

type SortKey = "recent" | "name" | "oldest";
type ViewMode = "grid" | "list";

const VIEW_MODE_KEY = "mediq.dashboard.viewMode";
const SORT_KEY = "mediq.dashboard.sortBy";

const PALETTES = [
  "from-primary/70 via-secondary/60 to-accent/60",
  "from-secondary/70 via-accent/60 to-primary/60",
  "from-accent/70 via-primary/60 to-secondary/60",
  "from-primary/70 via-accent/60 to-secondary/60",
  "from-secondary/70 via-primary/60 to-accent/60",
];

function projectGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "P";
}

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return t("dashboard.today");
  if (days === 1) return t("dashboard.yesterday");
  if (days < 7) return t("dashboard.daysAgo", { n: days });
  if (days < 30) return t("dashboard.weeksAgo", { n: Math.floor(days / 7) });
  return t("dashboard.monthsAgo", { n: Math.floor(days / 30) });
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openLoadingId, setOpenLoadingId] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortKey>(() => {
    if (typeof window === "undefined") return "recent";
    const stored = window.localStorage.getItem(SORT_KEY) as SortKey | null;
    return stored ?? "recent";
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const stored = window.localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
    return stored ?? "grid";
  });

  useEffect(() => {
    window.localStorage.setItem(SORT_KEY, sortBy);
  }, [sortBy]);
  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const tips = t("dashboard.tips", { returnObjects: true }) as string[];

  const dailyTip = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
    return tips[dayOfYear % tips.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language === "en" ? "en-US" : "fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [i18n.language]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return t("dashboard.greetingNight");
    if (h < 12) return t("dashboard.greetingMorning");
    if (h < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const firstName = (user?.fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const appPath = (path: string) => withDemoPrefix(path, location.pathname);

  const openProject = async (project: Project) => {
    setOpenLoadingId(project.id);
    try {
      const datasets = await datasetService.list(project.id);
      if (datasets.length > 0) {
        navigate(appPath(`/projects/${project.id}/database`));
      } else {
        navigate(appPath(`/projects/${project.id}/import`));
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: (error as Error).message || t("dashboard.openingError"),
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
          title: t("common.error"),
          description: t("dashboard.loadError"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, toast, t]);

  const handleDelete = async () => {
    if (!deleteProject || isDeleting) return;

    setIsDeleting(true);
    try {
      await projectService.deleteProject(deleteProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteProject.id));
      setDeleteProject(null);
      toast({ title: t("dashboard.deletedSuccess") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const sortedProjects = useMemo(() => {
    const arr = [...filteredProjects];
    switch (sortBy) {
      case "name":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "oldest":
        return arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      case "recent":
      default:
        return arr.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    }
  }, [filteredProjects, sortBy]);

  const now = Date.now();
  const thisMonthCount = projects.filter((p) => {
    const d = new Date(p.createdAt).getTime();
    return now - d < 30 * 86_400_000;
  }).length;

  const lastUpdated = projects.reduce<Project | null>((latest, p) => {
    if (!latest) return p;
    return new Date(p.updatedAt) > new Date(latest.updatedAt) ? p : latest;
  }, null);

  // Buckets — projects created / updated over the last 8 weeks (for sparklines)
  const activitySeries = useMemo(() => {
    const buckets = new Array(8).fill(0);
    const weekMs = 7 * 86_400_000;
    projects.forEach((p) => {
      const age = Date.now() - new Date(p.createdAt).getTime();
      const idx = 7 - Math.min(7, Math.floor(age / weekMs));
      if (idx >= 0) buckets[idx] += 1;
    });
    return buckets;
  }, [projects]);

  const monthSeries = useMemo(() => {
    const buckets = new Array(6).fill(0);
    const dayMs = 86_400_000;
    projects.forEach((p) => {
      const age = Date.now() - new Date(p.createdAt).getTime();
      const idx = 5 - Math.min(5, Math.floor(age / (5 * dayMs)));
      if (idx >= 0 && age <= 30 * dayMs) buckets[idx] += 1;
    });
    return buckets;
  }, [projects]);

  if (isLoading) {
    return (
      <AppLayout hideSidebar>
        <PageSkeleton />
      </AppLayout>
    );
  }

  const hasProjects = projects.length > 0;

  return (
    <AppLayout hideSidebar>
      {/* === Dashboard-scoped background — layered on top of the AppLayout aurora === */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Vibrant mesh wash (with violet accent) */}
        <div className="absolute inset-0 bg-mesh-vibrant opacity-95" />
        {/* Floating color orbs — slow breathing motion */}
        <div className="animate-breathing absolute -left-32 top-[10%] h-[420px] w-[420px] rounded-full bg-primary/25 blur-[120px]" />
        <div
          className="animate-breathing absolute -right-24 top-[25%] h-[380px] w-[380px] rounded-full bg-secondary/25 blur-[120px]"
          style={{ animationDelay: "-3s" }}
        />
        <div
          className="animate-breathing absolute left-1/3 top-[55%] h-[340px] w-[340px] rounded-full blur-[110px]"
          style={{ animationDelay: "-6s", background: "hsl(265 85% 65% / 0.18)" }}
        />
        <div
          className="animate-breathing absolute right-1/4 bottom-[5%] h-[300px] w-[300px] rounded-full bg-accent/20 blur-[110px]"
          style={{ animationDelay: "-1.5s" }}
        />
        {/* SVG connection lines — subtle data viz feel */}
        <div className="absolute inset-x-0 top-[200px] h-[600px] bg-connection-lines opacity-40" />
        {/* Twinkling decorative dots — very subtle constellation */}
        <span className="absolute left-[8%]   top-[12%] h-px w-px rounded-full bg-primary/50   shadow-[0_0_4px_0px] shadow-primary/30   animate-twinkle-slow" />
        <span className="absolute left-[22%]  top-[6%]  h-px w-px rounded-full bg-secondary/40 shadow-[0_0_3px_0px] shadow-secondary/30 animate-twinkle-slow" />
        <span className="absolute right-[14%] top-[18%] h-1  w-1  rounded-full bg-accent/40    shadow-[0_0_5px_0px] shadow-accent/25    animate-twinkle-slow" />
        <span className="absolute right-[8%]  top-[8%]  h-px w-px rounded-full bg-primary/40   shadow-[0_0_3px_0px] shadow-primary/25   animate-twinkle-slow" />
        <span className="absolute left-[6%]   top-[55%] h-px w-px rounded-full bg-accent/40    shadow-[0_0_4px_0px] shadow-accent/25    animate-twinkle-slow" />
        <span className="absolute right-[6%]  top-[45%] h-px w-px rounded-full bg-secondary/40 shadow-[0_0_3px_0px] shadow-secondary/25 animate-twinkle-slow" />
        <span className="absolute left-[40%]  top-[80%] h-px w-px rounded-full bg-primary/35   shadow-[0_0_3px_0px] shadow-primary/20   animate-twinkle-slow" />
        <span className="absolute right-[28%] top-[88%] h-1  w-1  rounded-full bg-accent/35    shadow-[0_0_4px_0px] shadow-accent/20    animate-twinkle-slow" />
      </div>

      <motion.div
        className="relative mx-auto w-full max-w-[clamp(1100px,75vw,1850px)] space-y-6 sm:space-y-8 lg:space-y-10 2xl:space-y-12"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        {/* ===== BENTO: HERO + ASIDE (stats + tip) ===== */}
        <motion.section
          variants={staggerItem}
          className="grid gap-4 sm:gap-5 lg:grid-cols-12 lg:items-start lg:gap-6"
        >
          {/* HERO */}
          <div className="ai-surface-strong shadow-card-glow relative flex flex-col overflow-hidden rounded-2xl p-5 sm:rounded-3xl sm:p-6 lg:col-span-8 lg:p-7 2xl:p-9">
            {/* Floating decorative orbs — drift slowly */}
            <div className="animate-drift-orbit pointer-events-none absolute -left-24 top-4 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
            <div
              className="animate-drift-orbit pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-secondary/25 blur-3xl"
              style={{ animationDelay: "-6s" }}
            />
            <div
              className="animate-drift-orbit pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 rounded-full blur-3xl"
              style={{ animationDelay: "-12s", background: "hsl(265 85% 65% / 0.22)" }}
            />
            {/* Inner top highlight — adds depth */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            <div className="relative flex h-full flex-col gap-4 sm:gap-5">
              {/* Header: chip + date pill + live indicator */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="ai-chip">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("dashboard.chip")}
                </span>
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md">
                  <Clock3 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{dayLabel}</span>
                </span>
              </div>

              <div className="min-w-0" data-tour="dashboard-hero">
                <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-[2rem] lg:text-[2.25rem] xl:text-[2.5rem] 2xl:text-[2.75rem]">
                  {greeting}
                  {firstName && (
                    <>
                      ,{" "}
                      <span className="text-gradient-animated">{firstName}</span>
                    </>
                  )}
                  <span className="text-foreground"> 👋</span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground 2xl:max-w-3xl 2xl:text-base">
                  {t("dashboard.subtitle")}
                </p>
              </div>

              {/* Pipeline info card — explains the app workflow */}
              <JourneyPipeline t={t} />

              {/* CTA */}
              <div className="flex w-full">
                <Button
                  data-tour="dashboard-new-project"
                  className="group/cta relative h-11 w-full gap-2 overflow-hidden bg-gradient-to-r from-primary via-[hsl(265_85%_60%)] to-secondary shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 sm:w-auto"
                  onClick={() => navigate(appPath("/projects/new"))}
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/cta:translate-x-full" />
                  <Plus className="h-4 w-4 transition-transform group-hover/cta:rotate-90" />
                  <span className="relative truncate">{t("dashboard.newProject")}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* ASIDE: user card + compact stats panel + tip card */}
          <div className="flex flex-col gap-4 sm:gap-5 lg:col-span-4 lg:gap-6">
            {/* User profile card — top of the aside column */}
            <ProfileMenu variant="card" />

            {/* Stats panel — one cohesive card with rows */}
            <div className="ai-surface shadow-card-glow relative overflow-hidden rounded-2xl bg-card/75 sm:rounded-3xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-secondary/10 blur-2xl" />
              <div className="relative grid grid-cols-1 divide-y divide-border/40 md:grid-cols-3 md:divide-x md:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
                <CompactStatRow
                  icon={<Layers className="h-4 w-4" />}
                  label={t("dashboard.totalProjects")}
                  value={projects.length}
                  tone="primary"
                  series={activitySeries}
                />
                <CompactStatRow
                  icon={<CalendarDays className="h-4 w-4" />}
                  label={t("dashboard.createdThisMonth")}
                  value={thisMonthCount}
                  sublabel={t("dashboard.createdThisMonthSub")}
                  tone="secondary"
                  series={monthSeries}
                />
                <CompactStatRow
                  icon={<TrendingUp className="h-4 w-4" />}
                  label={t("dashboard.lastActivity")}
                  valueText={lastUpdated?.name ?? "—"}
                  sublabel={lastUpdated ? timeAgo(lastUpdated.updatedAt, t) : undefined}
                  tone="accent"
                />
              </div>
            </div>
          </div>
        </motion.section>

        {/* ===== TIP (full-width strip below the bento) ===== */}
        <motion.div variants={fadeInUp}>
          <Card className="ai-surface group relative overflow-hidden border-primary/25 bg-gradient-to-r from-primary/[0.12] via-[hsl(265_85%_65%/0.05)] to-accent/[0.04] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 animate-breathing rounded-full bg-primary/20 blur-2xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-12 h-28 w-28 animate-breathing rounded-full bg-accent/15 blur-2xl" style={{ animationDelay: "-4s" }} />
            <CardContent className="relative flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-secondary/20 ring-1 ring-primary/30 shadow-sm sm:h-11 sm:w-11">
                <span className="pointer-events-none absolute inset-0 rounded-xl bg-primary/30 blur-md opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
                <Lightbulb className="relative h-4 w-4 text-primary sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{t("dashboard.tipTitle")}</p>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {new Date().toLocaleDateString(i18n.language === "en" ? "en-US" : "fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{dailyTip}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ===== PROJECTS ===== */}
        <motion.section variants={staggerItem} className="space-y-5">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl 2xl:text-4xl">
                {t("dashboard.yourProjects")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm 2xl:text-base">
                {t("dashboard.yourProjectsSub")}
              </p>
            </div>

            {hasProjects && (
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative w-full md:flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("dashboard.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 w-full border-border/70 bg-card/70 pl-10"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                    <SelectTrigger className="h-11 flex-1 border-border/70 bg-card/70 sm:w-[180px] sm:flex-none">
                      <SelectValue placeholder={t("dashboard.sortBy")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">{t("dashboard.sortRecent")}</SelectItem>
                      <SelectItem value="name">{t("dashboard.sortName")}</SelectItem>
                      <SelectItem value="oldest">{t("dashboard.sortOldest")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex h-11 flex-shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1">
                    <ViewToggleButton
                      active={viewMode === "grid"}
                      onClick={() => setViewMode("grid")}
                      label={t("dashboard.viewGrid")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </ViewToggleButton>
                    <ViewToggleButton
                      active={viewMode === "list"}
                      onClick={() => setViewMode("list")}
                      label={t("dashboard.viewList")}
                    >
                      <ListIcon className="h-4 w-4" />
                    </ViewToggleButton>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Empty states */}
          {!hasProjects && (
            <Card className="ai-surface relative overflow-hidden border-dashed">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-accent/[0.05]" />
              <CardContent className="relative flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-secondary/15 to-accent/15 ring-1 ring-primary/20">
                  <FolderOpen className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{t("dashboard.emptyTitle")}</p>
                  <p className="max-w-md text-sm text-muted-foreground">{t("dashboard.emptySub")}</p>
                </div>
                <Button className="mt-2 gap-2 shadow-lg shadow-primary/20" onClick={() => navigate(appPath("/projects/new"))}>
                  <Plus className="h-4 w-4" />
                  {t("dashboard.createFirst")}
                </Button>
              </CardContent>
            </Card>
          )}

          {hasProjects && !sortedProjects.length && (
            <Card className="ai-surface border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Search className="h-7 w-7 text-muted-foreground" />
                <p className="font-medium">{t("dashboard.noProjectFound")}</p>
                <p className="max-w-sm text-sm text-muted-foreground">{t("dashboard.noProjectFoundSub")}</p>
              </CardContent>
            </Card>
          )}

          {/* Projects */}
          {!!sortedProjects.length && (
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4 2xl:gap-6"
                  : "flex flex-col gap-3"
              )}
            >
              {sortedProjects.map((project, index) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  index={index}
                  viewMode={viewMode}
                  isLastUpdated={project.id === lastUpdated?.id}
                  isNew={
                    new Date(project.createdAt).getTime() > now - 30 * 86_400_000 &&
                    project.id !== lastUpdated?.id
                  }
                  isOpening={openLoadingId === project.id}
                  onOpen={() => openProject(project)}
                  onDelete={() => setDeleteProject(project)}
                  t={t}
                />
              ))}
            </div>
          )}
        </motion.section>
      </motion.div>

      <ConfirmModal
        isOpen={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDelete}
        title={t("dashboard.deleteTitle")}
        description={`${t("dashboard.deleteDesc")} "${deleteProject?.name}" ?`}
        variant="destructive"
        confirmText={t("common.delete")}
        isLoading={isDeleting}
      />
    </AppLayout>
  );
}

/* ============================================================== */
/* Sub-components                                                  */
/* ============================================================== */

interface CompactStatRowProps {
  icon: React.ReactNode;
  label: string;
  value?: number;
  valueText?: string;
  sublabel?: string;
  tone: "primary" | "secondary" | "accent";
  series?: number[];
}

const TONE_STROKE = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
} as const;

function CompactStatRow({ icon, label, value, valueText, sublabel, tone, series }: CompactStatRowProps) {
  const toneStyles = {
    primary: "bg-primary/15 text-primary ring-primary/25",
    secondary: "bg-secondary/15 text-secondary ring-secondary/25",
    accent: "bg-accent/15 text-accent ring-accent/25",
  }[tone];

  return (
    <div className="group relative flex items-center gap-3 overflow-hidden p-4 transition-colors hover:bg-muted/40 sm:p-5">
      <div
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
          toneStyles
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {value != null ? (
          <p className="text-2xl font-bold leading-tight tracking-tight tabular-nums">
            <AnimatedCounter value={value} />
          </p>
        ) : (
          <p className="truncate text-sm font-bold leading-tight">{valueText}</p>
        )}
        {sublabel && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sublabel}</p>}
      </div>
      {series && series.length > 0 && (
        <div className="hidden flex-shrink-0 sm:block">
          <Sparkline data={series} stroke={TONE_STROKE[tone]} />
        </div>
      )}
    </div>
  );
}

/** Animated counter — eased number tween (0 → value) */
function AnimatedCounter({ value, duration = 1.1 }: { value: number; duration?: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, duration, motionValue]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [rounded]);

  return <>{display}</>;
}

/** Mini bar sparkline (8 buckets max) — grows in on mount */
function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {data.map((v, i) => {
        const h = Math.max(8, (v / max) * 100);
        return (
          <span
            key={i}
            className="animate-spark-rise w-1 rounded-full"
            style={{
              height: `${h}%`,
              background: `linear-gradient(180deg, ${stroke} 0%, ${stroke}55 100%)`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

interface JourneyPipelineProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function JourneyPipeline({ t }: JourneyPipelineProps) {
  const steps = [
    { icon: Upload, label: t("dashboard.journeyStep1"), hint: t("dashboard.journeyStep1Hint"), tone: "primary" },
    { icon: Wand2, label: t("dashboard.journeyStep2"), hint: t("dashboard.journeyStep2Hint"), tone: "secondary" },
    { icon: Brain, label: t("dashboard.journeyStep3"), hint: t("dashboard.journeyStep3Hint"), tone: "accent" },
    { icon: Target, label: t("dashboard.journeyStep4"), hint: t("dashboard.journeyStep4Hint"), tone: "primary" },
  ] as const;

  const toneClass = {
    primary: "bg-primary/15 text-primary ring-primary/25",
    secondary: "bg-secondary/15 text-secondary ring-secondary/25",
    accent: "bg-accent/15 text-accent ring-accent/25",
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-xl sm:rounded-2xl sm:p-4">
      {/* Subtle gradient sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.05]" />
      <div className="relative mb-2.5 flex items-center gap-2">
        <Compass className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">
          {t("dashboard.journeyTitle")}
        </p>
      </div>
      <div className="relative grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-start gap-x-0">
        {steps.map((step, i) => (
          <Fragment key={step.label}>
            <motion.div
              className="flex w-20 flex-col items-center text-center sm:w-24"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
            >
              <div
                className={cn(
                  "group/step relative flex h-12 w-12 items-center justify-center rounded-xl ring-1 shadow-sm transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 hover:shadow-md sm:h-14 sm:w-14 sm:rounded-2xl",
                  toneClass[step.tone]
                )}
              >
                <span className="pointer-events-none absolute inset-0 rounded-xl bg-current opacity-0 blur-md transition-opacity duration-300 group-hover/step:opacity-30 sm:rounded-2xl" />
                <step.icon className="relative h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <p className="mt-2 w-full truncate text-[11px] font-semibold leading-tight sm:text-xs">{step.label}</p>
              <p className="mt-0.5 hidden w-full truncate text-[10px] leading-tight text-muted-foreground sm:block sm:text-[11px]">
                {step.hint}
              </p>
            </motion.div>
            {i < steps.length - 1 && (
              <div className="relative mt-6 flex items-center sm:mt-7">
                <div className="h-px w-full bg-gradient-to-r from-border via-primary/40 to-border" />
                <ChevronRight className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-primary/60 sm:h-3.5 sm:w-3.5" />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

interface ViewToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function ViewToggleButton({ active, onClick, label, children }: ViewToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
        active
          ? "bg-primary/15 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

interface ProjectItemProps {
  project: Project;
  index: number;
  viewMode: ViewMode;
  isLastUpdated: boolean;
  isNew: boolean;
  isOpening: boolean;
  onOpen: () => void;
  onDelete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function ProjectItem({
  project,
  index,
  viewMode,
  isLastUpdated,
  isNew,
  isOpening,
  onOpen,
  onDelete,
  t,
}: ProjectItemProps) {
  const gradient = projectGradient(project.name);
  const initials = projectInitials(project.name);

  if (viewMode === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.25 }}
      >
        <Card
          className="ai-surface ring-gradient-hover group relative cursor-pointer overflow-hidden border-border/60 bg-card/80 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
          onClick={onOpen}
        >
          <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
            <div
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white shadow-md sm:h-12 sm:w-12 sm:text-sm",
                gradient
              )}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-sm font-semibold sm:text-base">{project.name}</h3>
                {isLastUpdated && (
                  <Badge variant="outline" className="border-accent/50 text-[10px] text-accent">
                    {t("dashboard.recentBadge")}
                  </Badge>
                )}
                {isNew && (
                  <Badge variant="outline" className="border-secondary/50 text-[10px] text-secondary">
                    {t("dashboard.newBadge")}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {project.description || t("dashboard.noDescription")}
              </p>
              {/* Mobile: meta info wraps under the title */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground sm:hidden">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {timeAgo(project.updatedAt, t)}
                </span>
                {project.accuracy != null && (
                  <span className="font-semibold text-primary">{project.accuracy}%</span>
                )}
              </div>
            </div>
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Clock3 className="h-3 w-3" />
              <span>{timeAgo(project.updatedAt, t)}</span>
            </div>
            {project.accuracy != null && (
              <div className="hidden text-xs font-semibold text-primary md:block">{project.accuracy}%</div>
            )}
            <ProjectActionsMenu onDelete={onDelete} t={t} />
            <ArrowUpRight className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Grid view
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={{ y: -4 }}
    >
      <Card
        className={cn(
          "ai-surface ring-gradient-hover group relative h-full cursor-pointer overflow-hidden border-border/60 bg-card/80 transition-all duration-300",
          "hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/15",
          isOpening && "opacity-70"
        )}
        onClick={onOpen}
      >
        {/* Top gradient accent — thicker bar with subtle shimmer on hover */}
        <div className={cn("relative h-1 bg-gradient-to-r overflow-hidden", gradient)}>
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        </div>
        {/* Glow on hover */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-secondary/[0.06] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <CardContent className="relative flex h-full flex-col gap-3 p-4 sm:gap-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-lg",
                gradient
              )}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 text-base font-semibold leading-tight tracking-tight">
                  {project.name}
                </h3>
                <ProjectActionsMenu onDelete={onDelete} t={t} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {isLastUpdated && (
                  <Badge variant="outline" className="border-accent/50 px-1.5 py-0 text-[10px] text-accent">
                    {t("dashboard.recentBadge")}
                  </Badge>
                )}
                {isNew && (
                  <Badge variant="outline" className="border-secondary/50 px-1.5 py-0 text-[10px] text-secondary">
                    {t("dashboard.newBadge")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
            {project.description || t("dashboard.noDescription")}
          </p>

          {project.accuracy != null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("dashboard.modelAccuracy")}</span>
                <span className="font-semibold text-foreground tabular-nums">
                  <AnimatedCounter value={project.accuracy} duration={1} />%
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${project.accuracy}%` }}
                  transition={{ duration: 0.9, delay: index * 0.05 + 0.2, ease: "easeOut" }}
                  className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-primary via-[hsl(265_85%_62%)] to-accent shadow-[0_0_10px_-2px_hsl(var(--primary)/0.6)]"
                >
                  <span className="animate-sweep pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                </motion.div>
              </div>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              <span>{timeAgo(project.updatedAt, t)}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              {isOpening ? t("common.opening") : t("dashboard.openAction")}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface ProjectActionsMenuProps {
  onDelete: () => void;
  t: (key: string) => string;
}

function ProjectActionsMenu({ onDelete, t }: ProjectActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("dashboard.actionsLabel")}
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete()}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("common.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default DashboardPage;
