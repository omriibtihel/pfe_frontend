import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserProfileDialog } from '@/components/UserProfileDialog';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/projects', icon: FolderOpen, label: 'Projets' },
];

const projectNavItems = [
  { path: 'import', icon: Upload, label: 'Import' },
  { path: 'database', icon: Database, label: 'Base de données' },
  { path: 'description', icon: FileText, label: 'Description' },
  { path: 'charts', icon: BarChart3, label: 'Graphiques' },
  { path: 'processing', icon: Settings2, label: 'Prétraitement' },
  { path: 'versions', icon: GitBranch, label: 'Versions' },
  { path: 'training', icon: Brain, label: 'Entraînement' },
  { path: 'predict', icon: Target, label: 'Prédiction' },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isProjectPage = location.pathname.includes('/projects/') && location.pathname.split('/').length > 2;
  const projectId = isProjectPage ? location.pathname.split('/')[2] : null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-xl border-b border-border/50 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-primary via-secondary to-accent rounded-xl flex items-center justify-center shadow-md">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">MedicalVision</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full bg-card/95 backdrop-blur-2xl border-r border-border/50 z-50 transition-all duration-400 ease-out flex flex-col",
        sidebarOpen ? "w-72" : "w-20",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-border/50">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-primary via-secondary to-accent rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/25">
              <Activity className="h-6 w-6 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight">MedicalVision</span>
                <span className="text-xs text-muted-foreground font-medium">AI Platform</span>
              </div>
            )}
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="hidden lg:flex rounded-xl hover:bg-muted"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", !sidebarOpen && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  isActive 
                    ? "nav-item-active text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-semibold">{item.label}</span>}
              </Link>
            );
          })}

          {/* Project Navigation */}
          {isProjectPage && projectId && (
            <>
              <div className={cn("pt-6 pb-3", sidebarOpen ? "px-4" : "px-0 flex justify-center")}>
                {sidebarOpen ? (
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Projet
                  </span>
                ) : (
                  <div className="w-8 h-0.5 rounded-full bg-border" />
                )}
              </div>
              {projectNavItems.map((item) => {
                const fullPath = `/projects/${projectId}/${item.path}`;
                const isActive = location.pathname === fullPath;
                return (
                  <Link
                    key={item.path}
                    to={fullPath}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                      isActive 
                        ? "bg-secondary/15 text-secondary border border-secondary/30" 
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

        {/* User Section */}
        <div className="p-4 border-t border-border/50 bg-muted/30 space-y-3">
          <ThemeToggle collapsed={!sidebarOpen} />
          <button
            onClick={() => setProfileOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl bg-card/50 hover:bg-card/80 transition-all duration-300 cursor-pointer group",
              !sidebarOpen && "justify-center p-2"
            )}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all">
              <User className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p className="font-semibold text-sm truncate">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
          </button>
          <Button 
            variant="ghost" 
            className={cn(
              "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-300", 
              !sidebarOpen && "px-0"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 font-medium">Déconnexion</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-400 ease-out pt-16 lg:pt-0",
        sidebarOpen ? "lg:ml-72" : "lg:ml-20"
      )}>
        <div className="p-6 lg:p-10">
          {children}
        </div>
      </main>

      {/* Profile Dialog */}
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

export default AppLayout;
