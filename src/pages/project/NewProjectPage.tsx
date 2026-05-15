import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FolderOpen, Loader2, Plus } from "lucide-react";
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
import { ProfileMenu } from "@/components/ProfileMenu";

export function NewProjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
      const project = await projectService.createProject({ name, description });

      toast({
        title: t("newProject.successTitle"),
        description: t("newProject.successTabular"),
      });

      navigate(`/projects/${project.id}/import`);
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
    <AppLayout hideSidebar>
      <motion.div
        className="mx-auto w-full max-w-2xl space-y-5 sm:space-y-6 lg:space-y-8"
        initial="initial"
        animate="animate"
        variants={fadeInUp}
      >
        {/* Top bar: back button on the left, profile menu on the right */}
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="-ml-2 gap-2"
            disabled={isCreating}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.back")}</span>
          </Button>
          <ProfileMenu variant="inline" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {t("newProject.title")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2 sm:text-base">
            {t("newProject.subtitle")}
          </p>
        </div>

        {/* Form card */}
        <Card>
          <CardHeader className="px-4 py-4 sm:px-6 sm:py-5">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FolderOpen className="h-4 w-4 flex-shrink-0 text-primary sm:h-5 sm:w-5" />
              {t("newProject.typeLabel")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6">
            <form onSubmit={handleCreate} className="space-y-5 sm:space-y-6">
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

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="w-full sm:flex-1"
                  disabled={isCreating}
                >
                  {t("common.cancel")}
                </Button>

                <Button
                  type="submit"
                  disabled={isCreating || !name.trim()}
                  className="w-full bg-gradient-to-r from-primary to-secondary sm:flex-1"
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
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
