import { ReactNode } from "react";
import { Activity, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-0 top-16 h-96 w-96 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/65 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold leading-none tracking-tight">MedIQ</div>
              <div className="mt-1 text-xs text-muted-foreground">Admin Console</div>
            </div>
            <Badge
              variant="secondary"
              className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary sm:inline-flex"
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Secure Session
            </Badge>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="rounded-xl border border-border/60 bg-card/65 px-3 py-2 text-xs text-muted-foreground backdrop-blur-xl sm:text-sm">
              <p className="font-medium text-foreground">{user?.fullName ?? "Admin"}</p>
              <p className="truncate">{user?.email ?? "-"}</p>
            </div>

            <Button variant="outline" className="rounded-xl" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Deconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1720px] px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
        {children}
      </main>
    </div>
  );
}
