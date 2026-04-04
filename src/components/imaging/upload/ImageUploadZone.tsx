import { useCallback, useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { imagingService } from "@/services/imagingService";
import { useToast } from "@/hooks/use-toast";
import type { ImageClassInfo } from "@/types/imaging";

interface Props {
  projectId: string | number;
  classes: ImageClassInfo[];
  onClassesChange: () => void;
}

export function ImageUploadZone({ projectId, classes, onClassesChange }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState("");

  const handleFiles = useCallback(
    async (files: File[], className: string) => {
      if (!className.trim()) return;
      setUploading(className);
      try {
        const result = await imagingService.uploadImages(projectId, className.trim(), files);
        toast({
          title: "Upload réussi",
          description: `${result.uploaded} image(s) ajoutée(s) dans "${className}".`,
        });
        onClassesChange();
      } catch {
        toast({ title: "Erreur upload", variant: "destructive" });
      } finally {
        setUploading(null);
      }
    },
    [projectId, onClassesChange, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, className: string) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length) handleFiles(files, className);
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, className: string) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) handleFiles(files, className);
      e.target.value = "";
    },
    [handleFiles]
  );

  const handleDeleteClass = async (className: string) => {
    if (!confirm(`Supprimer la classe "${className}" et toutes ses images ?`)) return;
    try {
      await imagingService.deleteImageClass(projectId, className);
      toast({ title: `Classe "${className}" supprimée.` });
      onClassesChange();
    } catch {
      toast({ title: "Erreur suppression", variant: "destructive" });
    }
  };

  const handleAddClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    if (classes.some((c) => c.name === name)) {
      toast({ title: "Cette classe existe déjà.", variant: "destructive" });
      return;
    }
    setNewClassName("");
    // Ouvrir directement le file picker pour la nouvelle classe
    const tmp = document.createElement("input");
    tmp.type = "file";
    tmp.multiple = true;
    tmp.accept = "image/*";
    tmp.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length) handleFiles(files, name);
    };
    tmp.click();
  };

  return (
    <div className="space-y-4">
      {/* Existing classes */}
      {classes.map((cls) => (
        <div
          key={cls.name}
          className="rounded-lg border-2 border-dashed border-border p-4 transition-colors hover:border-primary/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, cls.name)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{cls.name}</span>
              <Badge variant="secondary">{cls.count} image(s)</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={uploading === cls.name}
                onClick={() => {
                  const inp = document.createElement("input");
                  inp.type = "file";
                  inp.multiple = true;
                  inp.accept = "image/*";
                  inp.onchange = (e) =>
                    handleFileInputChange(e as any, cls.name);
                  inp.click();
                }}
              >
                {uploading === cls.name ? "Upload..." : "Ajouter"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDeleteClass(cls.name)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Glissez-déposez des images ici ou cliquez sur "Ajouter".
          </p>
        </div>
      ))}

      {/* Add new class */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
          placeholder="Nom de la nouvelle classe…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button variant="outline" onClick={handleAddClass} disabled={!newClassName.trim()}>
          <Upload className="h-4 w-4 mr-1" />
          Créer classe
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
