import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Activity,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const features = [
  { icon: Shield, label: "Sécurisé", desc: "Données chiffrées" },
  { icon: Zap, label: "Rapide", desc: "IA en temps réel" },
  { icon: BarChart3, label: "Précis", desc: "98% de précision" },
];

// ✅ On garde ta logique (email/password vides, role-based redirect, extractErrorMessage)
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const extractErrorMessage = (err: any) => {
    // FastAPI peut renvoyer {detail: "..."} ou {detail: [{...}]}
    const detail = err?.response?.data?.detail;
    if (!detail) return err?.message || "Erreur lors de la connexion";

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      // pydantic errors
      return detail.map((e) => e?.msg || JSON.stringify(e)).join(", ");
    }

    return JSON.stringify(detail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const u = await login({ email, password });

      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur MedicalVision",
      });

      if (u.role === "admin") navigate("/admin");
      else navigate("/dashboard");
    } catch (error: any) {
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
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-accent/30 blur-[120px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-secondary/40 blur-[150px] translate-x-1/4 translate-y-1/4" />
          <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full bg-primary-foreground/10 blur-[100px] -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center border border-primary-foreground/20">
                <Activity className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-primary-foreground tracking-tight">
                MedicalVision
              </span>
            </div>
          </motion.div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="space-y-4"
            >
              <h1 className="text-5xl font-extrabold text-primary-foreground leading-[1.1] tracking-tight">
                L'IA qui
                <br />
                transforme la
                <br />
                <span className="text-accent">médecine.</span>
              </h1>
              <p className="text-primary-foreground/70 text-lg max-w-md leading-relaxed">
                Analysez, entraînez et prédisez avec des modèles d'intelligence
                artificielle de dernière génération.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex gap-4"
            >
              {features.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/10"
                >
                  <f.icon className="w-5 h-5 text-accent" />
                  <div>
                    <div className="text-sm font-semibold text-primary-foreground">
                      {f.label}
                    </div>
                    <div className="text-xs text-primary-foreground/50">
                      {f.desc}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-primary-foreground/40 text-sm"
          >
            © {new Date().getFullYear()} MedicalVision · Plateforme IA médicale
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-[420px] space-y-8"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-secondary to-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              MedicalVision
            </span>
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              Bienvenue
            </h2>
            <p className="text-muted-foreground">
              Connectez-vous à votre espace médical
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Adresse email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 bg-muted/50 border-border/50 focus:bg-background"
                  placeholder="votre@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  Mot de passe
                </Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 bg-muted/50 border-border/50 focus:bg-background"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold gap-2"
              size="lg"
              disabled={isLoading}
            >
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

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-background text-muted-foreground">
                ou
              </span>
            </div>
          </div>

          {/* Signup Link */}
          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link
              to="/signup"
              className="text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              S'inscrire
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default LoginPage;
