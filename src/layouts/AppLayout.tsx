import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  FolderOpen,
  Upload,
  Database,
  Settings2,
  GitBranch,
  Sliders,
  Brain,
  Target,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  BarChart3,
  ImageIcon,
} from "lucide-react";

import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppLayoutProps {
  children: ReactNode;
}

// Nav items are built inside the component to be reactive to language changes

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { path: "/projects",  icon: FolderOpen,       label: t("nav.projects") },
  ];

  const projectNavItems = [
    { path: "import",      icon: Upload,    label: t("nav.import") },
    { path: "database",    icon: Database,  label: t("nav.data") },
    { path: "charts",      icon: BarChart3, label: t("nav.charts") },
    { path: "nettoyage",   icon: Settings2, label: t("nav.cleaning") },
    { path: "versions",    icon: GitBranch, label: t("nav.versions") },
    { path: "preparation", icon: Sliders,   label: t("nav.preparation") },
    { path: "training",    icon: Brain,     label: t("nav.training") },
    { path: "predict",     icon: Target,    label: t("nav.prediction") },
  ];

  const imagingNavItems = [
    { path: "imaging/import",   icon: Upload, label: t("nav.imagingImport") },
    { path: "imaging/training", icon: Brain,  label: t("nav.imagingTraining") },
    { path: "imaging/predict",  icon: Target, label: t("nav.imagingPrediction") },
  ];
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return stored === "dark" || (!stored && prefersDark);
  });
  const { user, logout } = useAuth();

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };
  const location = useLocation();
  const navigate = useNavigate();

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isProjectPage = pathSegments[0] === "projects" && Boolean(pathSegments[1]);
  const projectId = isProjectPage ? pathSegments[1] : null;
  const isImagingProject = isProjectPage && pathSegments[2] === "imaging";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isRootNavActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    if (path === "/projects") return location.pathname.startsWith("/projects");
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const isProjectNavActive = (segment: string) => {
    if (!projectId) return false;
    const current = location.pathname;
    const base = `/projects/${projectId}/${segment}`;

    if (segment === "training") {
      const directTraining =
        current === `/projects/${projectId}/training` || current.startsWith(`/projects/${projectId}/training/`);
      const versionTraining =
        current.startsWith(`/projects/${projectId}/versions/`) && current.includes("/training");
      return directTraining || versionTraining;
    }

    if (segment === "predict") {
      return current === `/projects/${projectId}/predict` || current.startsWith(`/projects/${projectId}/predict/`);
    }
    if (segment === "versions") {
      const onVersionsTree = current === `/projects/${projectId}/versions` || current.startsWith(`/projects/${projectId}/versions/`);
      return onVersionsTree && !current.includes("/training") && !current.includes("/predict");
    }

    return current === base || current.startsWith(`${base}/`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 ai-grid-bg opacity-[0.45]" />
      <div className="pointer-events-none absolute -top-32 left-[20%] h-[360px] w-[360px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-110px] top-[16%] h-[320px] w-[320px] rounded-full bg-secondary/15 blur-[110px]" />

      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/60 bg-card/85 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((prev) => !prev)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-secondary to-accent shadow-glow-sm">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">MedicalVision</span>
          </Link>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setProfileOpen(true)}>
          <User className="h-4 w-4 text-primary" />
        </Button>
      </header>

      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-border/60 bg-card/90 backdrop-blur-2xl transition-all duration-300",
          sidebarOpen ? "w-72" : "w-20",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-border/60 px-5">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent shadow-lg shadow-primary/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex min-w-0 flex-col">
                <span className="text-lg font-bold tracking-tight">MedicalVision</span>
                <span className="text-xs font-medium text-muted-foreground">{t("nav.aiSpace")}</span>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-xl hover:bg-muted lg:flex"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", !sidebarOpen && "rotate-180")} />
          </Button>
        </div>


        <nav className="flex-1 space-y-2 overflow-y-auto p-4 scrollbar-modern">
          {navItems.map((item) => {
            const isActive = isRootNavActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300",
                  isActive ? "nav-item-active text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-semibold">{item.label}</span>}
              </Link>
            );
          })}

          {isProjectPage && projectId && (
            <>
              <div className={cn("pb-3 pt-6", sidebarOpen ? "px-4" : "flex justify-center px-0")}>
                {sidebarOpen ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {isImagingProject && <ImageIcon className="h-3 w-3" />}
                    {t("nav.project")}
                  </span>
                ) : (
                  <div className="h-0.5 w-8 rounded-full bg-border" />
                )}
              </div>

              {(isImagingProject ? imagingNavItems : projectNavItems).map((item) => {
                const fullPath = `/projects/${projectId}/${item.path}`;
                const isActive = location.pathname.startsWith(fullPath) ||
                  (item.path === "imaging/training" && location.pathname.startsWith(`/projects/${projectId}/imaging/results`));
                return (
                  <Link
                    key={item.path}
                    to={fullPath}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300",
                      isActive
                        ? "border border-secondary/35 bg-secondary/15 text-secondary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && <span className="font-medium">{item.label}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="border-t border-border/60 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "group w-full cursor-pointer rounded-xl border border-border/60 bg-card/70 p-3",
                  "flex items-center gap-3 transition-all duration-300 hover:bg-card",
                  !sidebarOpen && "justify-center p-2"
                )}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-2 ring-primary/10 transition-all group-hover:ring-primary/35 overflow-hidden">
                  {user?.profilePhoto ? (
                    <img
                      src={`http://127.0.0.1:8000${user.profilePhoto}`}
                      alt={user.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
                      <User className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
                    </div>
                  )}
                </div>
                {sidebarOpen && (
                  <>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="font-semibold">{user?.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-transparent cursor-default p-0">
                <div className="flex w-full items-center justify-between px-2 py-1.5">
                  <span className="relative h-5 overflow-hidden text-sm">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={isDark ? "dark" : "light"}
                        className="block"
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0,  opacity: 1 }}
                        exit={{    y: -14, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {isDark ? t("nav.darkMode") : t("nav.lightMode")}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-transparent cursor-default p-0">
                <div className="w-full px-2 py-1.5">
                  <LanguageSwitcher variant="pill" />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                {t("nav.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main
        className={cn(
          "relative min-h-screen pt-16 transition-all duration-300 lg:pt-0",
          sidebarOpen ? "lg:ml-72" : "lg:ml-20"
        )}
      >
        <div className="w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10 xl:py-10">{children}</div>
      </main>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

export default AppLayout;
