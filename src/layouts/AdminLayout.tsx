import { ReactNode } from "react";
import { Activity, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold leading-none">MedicalVision</div>
              <div className="text-xs text-muted-foreground">Admin Console</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {user?.fullName} • {user?.email}
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
