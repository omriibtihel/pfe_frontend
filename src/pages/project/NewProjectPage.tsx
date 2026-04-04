import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FolderOpen, Loader2, Database, ImageIcon } from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { projectService } from "@/services/projectService";
import { fadeInUp } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";

export function NewProjectPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<"tabular" | "imaging">("tabular");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Session expirée",
        description: "Veuillez vous reconnecter.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setIsCreating(true);
    try {
      const project = await projectService.createProject({
        name,
        description,
        projectType,
      });

      toast({
        title: "Projet créé",
        description: projectType === "imaging"
          ? "Vous pouvez maintenant importer vos images."
          : "Vous pouvez maintenant importer vos données.",
      });

      if (projectType === "imaging") {
        navigate(`/projects/${project.id}/imaging/import`);
      } else {
        navigate(`/projects/${project.id}/import`);
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: (error as Error).message || "Impossible de créer le projet",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AppLayout>
      <motion.div
        className="max-w-2xl mx-auto space-y-6"
        initial="initial"
        animate="animate"
        variants={fadeInUp}
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nouveau projet</h1>
          <p className="text-muted-foreground mt-1">
            Créez un nouveau projet d'analyse médicale
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Informations du projet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du projet</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Diagnostic Cardiaque"
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez l'objectif de ce projet d'analyse..."
                  rows={3}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label>Type de données</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => setProjectType("tabular")}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                      projectType === "tabular"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    <Database className={cn("h-5 w-5", projectType === "tabular" ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="font-semibold text-sm">Tabulaire</p>
                      <p className="text-xs text-muted-foreground mt-0.5">CSV / Excel — sklearn, XGBoost…</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => setProjectType("imaging")}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                      projectType === "imaging"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    <ImageIcon className={cn("h-5 w-5", projectType === "imaging" ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="font-semibold text-sm">Imagerie</p>
                      <p className="text-xs text-muted-foreground mt-0.5">JPG / PNG — ResNet, EfficientNet…</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="flex-1"
                  disabled={isCreating}
                >
                  Annuler
                </Button>

                <Button
                  type="submit"
                  disabled={isCreating || !name.trim()}
                  className="flex-1 bg-gradient-to-r from-primary to-secondary"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Créer le projet
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}

export default NewProjectPage;
