import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  FolderOpen,
  Upload,
  Database,
  Settings2,
  GitBranch,
  Sliders,
  Brain,
  Target,
  Menu,
  X,
  ChevronLeft,
  BarChart3,
} from "lucide-react";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfileMenu } from "@/components/ProfileMenu";

interface AppLayoutProps {
  children: ReactNode;
  hideSidebar?: boolean;
}

// Nav items are built inside the component to be reactive to language changes

const SIDEBAR_OPEN_KEY = "mediq.sidebarOpen.v2";

export function AppLayout({ children, hideSidebar = false }: AppLayoutProps) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (stored !== null) return stored === "true";
    return true;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
      if (e.matches) setMobileMenuOpen(false);
    };
    setIsMobile(!mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMenuOpen]);

  // On mobile, the drawer always shows full labels regardless of the desktop collapse state
  const showLabels = isMobile || sidebarOpen;

  const navItems = [
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

  const location = useLocation();

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isProjectPage = pathSegments[0] === "projects" && Boolean(pathSegments[1]);
  const projectId = isProjectPage ? pathSegments[1] : null;

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
      {/* Aurora band at the top (conic gradient sweep) */}
      <div className="pointer-events-none absolute inset-x-0 -top-32 h-[560px] bg-aurora-band" />

      {/* Faded grid pattern, anchored at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1100px] bg-grid-fade" />

      {/* Floating gradient blobs (animated) */}
      <div className="pointer-events-none absolute -top-32 left-[18%] h-[420px] w-[420px] rounded-full bg-primary/25 blur-[130px] bg-aurora-blob" />
      <div className="pointer-events-none absolute right-[-140px] top-[12%] h-[380px] w-[380px] rounded-full bg-secondary/20 blur-[120px] bg-aurora-blob-alt" />
      <div className="pointer-events-none absolute left-[-100px] top-[55%] h-[340px] w-[340px] rounded-full bg-accent/18 blur-[120px] bg-aurora-blob-slow" />
      <div className="pointer-events-none absolute right-[12%] bottom-[8%] h-[300px] w-[300px] rounded-full bg-primary/15 blur-[110px] bg-aurora-blob-alt" />

      {/* Subtle dot mesh in the middle for additional depth */}
      <div className="pointer-events-none absolute inset-x-0 top-[300px] h-[700px] bg-dot-mesh opacity-60" />

      {/* Note: when hideSidebar=true, the page itself renders the ProfileMenu inline.
          The mobile header below is only for non-dashboard pages (sidebar layout). */}

      {!hideSidebar && (
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/60 bg-card/85 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((prev) => !prev)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-secondary to-accent shadow-glow-sm">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">MedIQ</span>
          </Link>
        </div>
        <ProfileMenu variant="inline" />
      </header>
      )}

      {!hideSidebar && mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label={t("nav.closeMenu")}
        />
      )}

      {!hideSidebar && (
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-border/60 bg-card/90 backdrop-blur-2xl transition-[transform,width] duration-300",
          // Mobile: drawer width adapts to small screens (max 88vw, capped at 18rem)
          "w-[min(18rem,88vw)]",
          // Desktop (lg+): respect the user's collapse toggle
          sidebarOpen ? "lg:w-72" : "lg:w-20",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-hidden={isMobile && !mobileMenuOpen}
      >
        <div className="flex h-20 items-center justify-between border-b border-border/60 px-5">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent shadow-lg shadow-primary/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            {showLabels && (
              <div className="flex min-w-0 flex-col">
                <span className="text-lg font-bold tracking-tight">MedIQ</span>
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
                title={showLabels ? undefined : item.label}
                aria-label={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-xl py-3 transition-all duration-300",
                  showLabels ? "px-4" : "justify-center px-0",
                  isActive ? "nav-item-active text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("flex-shrink-0", showLabels ? "h-5 w-5" : "h-6 w-6")} />
                {showLabels && <span className="font-semibold">{item.label}</span>}
              </Link>
            );
          })}

          {isProjectPage && projectId && (
            <>
              <div className={cn("pb-3 pt-6", showLabels ? "px-4" : "flex justify-center px-0")}>
                {showLabels ? (
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("nav.project")}
                  </span>
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
                    title={showLabels ? undefined : item.label}
                    aria-label={item.label}
                    className={cn(
                      "flex items-center gap-3 rounded-xl py-3 transition-all duration-300",
                      showLabels ? "px-4" : "justify-center px-0",
                      isActive
                        ? "border border-secondary/35 bg-secondary/15 text-secondary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("flex-shrink-0", showLabels ? "h-5 w-5" : "h-6 w-6")} />
                    {showLabels && <span className="font-medium">{item.label}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="border-t border-border/60 p-3">
          <ProfileMenu variant="sidebar" sidebarOpen={showLabels} />
        </div>
      </aside>
      )}

      <main
        className={cn(
          "relative min-h-screen transition-all duration-300",
          hideSidebar ? "pt-0" : "pt-16 lg:pt-0",
          !hideSidebar && (sidebarOpen ? "lg:ml-72" : "lg:ml-20")
        )}
      >
        <div className="w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10 xl:py-10 2xl:px-14 2xl:py-12">
          {children}
        </div>
      </main>

    </div>
  );
}

export default AppLayout;
