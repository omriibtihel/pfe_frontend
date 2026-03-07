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
  Brain,
  Target,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  User,
  BarChart3,
  FileText,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileDialog } from "@/components/UserProfileDialog";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/projects", icon: FolderOpen, label: "Projets" },
];

const projectNavItems = [
  { path: "import", icon: Upload, label: "Import" },
  { path: "database", icon: Database, label: "Base de donnees" },
  { path: "description", icon: FileText, label: "Description" },
  { path: "charts", icon: BarChart3, label: "Graphiques" },
  { path: "processing", icon: Settings2, label: "Pretraitement" },
  { path: "versions", icon: GitBranch, label: "Versions" },
  { path: "training", icon: Brain, label: "Entrainement" },
  { path: "predict", icon: Target, label: "Prediction" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isProjectPage = pathSegments[0] === "projects" && Boolean(pathSegments[1]);
  const projectId = isProjectPage ? pathSegments[1] : null;

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
                <span className="text-xs font-medium text-muted-foreground">AI Medical Workspace</span>
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

        {sidebarOpen && (
          <div className="px-4 pt-4">
            <div className="ai-surface flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace actif
              </div>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                Online
              </span>
            </div>
          </div>
        )}

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
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Projet</span>
                ) : (
                  <div className="h-0.5 w-8 rounded-full bg-border" />
                )}
              </div>

              {projectNavItems.map((item) => {
                const fullPath = `/projects/${projectId}/${item.path}`;
                const isActive = isProjectNavActive(item.path);
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

        <div className="space-y-3 border-t border-border/60 bg-muted/20 p-4">
          <ThemeToggle collapsed={!sidebarOpen} />

          <button
            onClick={() => setProfileOpen(true)}
            className={cn(
              "group w-full cursor-pointer rounded-xl border border-border/60 bg-card/70 p-3 transition-all duration-300 hover:bg-card",
              "flex items-center gap-3",
              !sidebarOpen && "justify-center p-2"
            )}
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 ring-2 ring-primary/10 transition-all group-hover:ring-primary/35">
              <User className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            )}
          </button>

          <Button
            variant="ghost"
            className={cn(
              "w-full rounded-xl text-muted-foreground transition-all duration-300 hover:bg-destructive/10 hover:text-destructive",
              !sidebarOpen && "px-0"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 font-medium">Deconnexion</span>}
          </Button>
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
