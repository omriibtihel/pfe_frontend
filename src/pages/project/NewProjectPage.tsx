import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FolderOpen, Loader2, Database, ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
        title: t("newProject.sessionExpired"),
        description: t("newProject.reconnect"),
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
        title: t("newProject.successTitle"),
        description: projectType === "imaging"
          ? t("newProject.successImaging")
          : t("newProject.successTabular"),
      });

      if (projectType === "imaging") {
        navigate(`/projects/${project.id}/imaging/import`);
      } else {
        navigate(`/projects/${project.id}/import`);
      }
    } catch (error) {
      toast({
        title: t("newProject.errorTitle"),
        description: (error as Error).message || t("newProject.errorCreate"),
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
          <h1 className="text-3xl font-bold text-foreground">{t("newProject.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("newProject.subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {t("newProject.typeLabel")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">{t("newProject.nameLabel")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("newProject.namePlaceholder")}
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("newProject.descriptionLabel")}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("newProject.descriptionPlaceholder")}
                  rows={3}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("newProject.typeLabel")}</Label>
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
                      <p className="font-semibold text-sm">{t("newProject.tabularTitle")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("newProject.tabularDesc")}</p>
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
                      <p className="font-semibold text-sm">{t("newProject.imagingTitle")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("newProject.imagingDesc")}</p>
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
                  {t("common.cancel")}
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
                  {isCreating ? t("newProject.submitting") : t("newProject.submit")}
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
