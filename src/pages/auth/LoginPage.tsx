import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Activity, Loader2, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      return detail
        .map((e) => e?.msg || JSON.stringify(e))
        .join(", ");
    }

    return JSON.stringify(detail);
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  try {
    const u = await login({ email, password });

    toast({ title: "Connexion réussie", description: "Bienvenue sur MedicalVision" });

    if (u.role === "admin") navigate("/admin");
    else navigate("/dashboard");
  } catch (error) {
    toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
  } finally {
    setIsLoading(false);
  }
};




  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
          <Activity className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">MedicalVision</span>
        </div>

        <div className="text-center lg:text-left">
          <h1 className="text-2xl font-bold text-foreground">Connexion</h1>
          <p className="text-muted-foreground mt-2">Accédez à votre espace médical</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                placeholder="votre@email.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Se connecter
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            S'inscrire
          </Link>
        </p>


      </div>
    </AuthLayout>
  );
}

export default LoginPage;
