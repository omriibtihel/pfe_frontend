import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Activity, Mail, Lock, Loader2, ArrowRight, Sparkles } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const extractErrorMessage = (error: unknown) => {
    const err = error as {
      message?: string;
      response?: { data?: { detail?: unknown } };
    };
    const detail = err.response?.data?.detail;

    if (!detail) return err.message || "Erreur lors de la connexion";
    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) return String((item as { msg?: unknown }).msg ?? "");
          return JSON.stringify(item);
        })
        .filter(Boolean)
        .join(", ");
    }

    return JSON.stringify(detail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login({ email, password });

      toast({
        title: "Connexion reussie",
        description: "Bienvenue sur MedicalVision",
      });

      if (user.role === "admin") navigate("/admin");
      else navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Erreur",
        description: extractErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-2.5 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-secondary to-accent">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">MedicalVision</span>
        </div>

        <div className="ai-surface-strong p-6 sm:p-8">
          <div className="mb-6 space-y-2">
            <span className="ai-chip">
              <Sparkles className="h-3.5 w-3.5" />
              Secure login
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Connexion a votre espace</h1>
            <p className="text-sm text-muted-foreground">Accedez a votre environnement de modelisation IA medicale.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-border/70 bg-card/70 pl-10"
                  placeholder="votre@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <button type="button" className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
                  Mot de passe oublie ?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-border/70 bg-card/70 pl-10"
                  placeholder="********"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" className="h-12 w-full gap-2 text-base font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/signup" className="font-semibold text-primary transition-colors hover:text-primary/80">
            S'inscrire
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
