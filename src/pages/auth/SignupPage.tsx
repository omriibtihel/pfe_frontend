import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Activity,
  Mail,
  Lock,
  User,
  Phone,
  Calendar,
  MapPin,
  Upload,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { SignupData } from "@/types";

export function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    dateOfBirth: "",
    phone: "",
    address: "",
  });

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };
  const navigate = useNavigate();
  const { toast } = useToast();

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const signupPayload: SignupData = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        specialty: "",
        qualification: "",
        experience: 0,
        phone: formData.phone,
        address: formData.address,
        hospital: "",
        dateOfBirth: formData.dateOfBirth,
        profilePhoto: profilePhoto ?? undefined,
      };

      const result = await signup(signupPayload);

      toast({ title: "Inscription reussie", description: result.message });
      navigate("/login");
    } catch (error) {
      toast({
        title: "Erreur",
        description: (error as Error).message,
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
              Create account
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Creer votre espace professionnel</h1>
            <p className="text-sm text-muted-foreground">
              Renseignez vos informations pour acceder a la plateforme IA medicale.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className="h-11 border-border/70 bg-card/70 pl-10"
                    placeholder="Dr. Jean Dupont"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="h-11 border-border/70 bg-card/70 pl-10"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className="h-11 border-border/70 bg-card/70 pl-10"
                    placeholder="********"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance</Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                    className="h-11 border-border/70 bg-card/70 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telephone</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="h-11 border-border/70 bg-card/70 pl-10"
                    placeholder="+216 ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="h-11 border-border/70 bg-card/70 pl-10"
                    placeholder="Hopital / Clinique"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Photo de profil</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-24 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              >
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="Aperçu"
                      className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/30"
                    />
                    <span className="text-xs">{profilePhoto?.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Cliquez pour ajouter une photo
                  </>
                )}
              </button>
            </div>

            <Button type="submit" className="h-12 w-full gap-2 text-base font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Inscription...
                </>
              ) : (
                <>
                  S'inscrire
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Deja inscrit ?{" "}
          <Link to="/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
            Se connecter
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default SignupPage;
