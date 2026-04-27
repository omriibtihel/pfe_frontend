import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  description?: string;
  stayLabel?: string;
  leaveLabel?: string;
};

export function UnsavedOpsModal({
  open,
  onStay,
  onLeave,
  title = "Opérations non sauvegardées",
  description = "Vous avez des opérations de nettoyage qui n'ont pas encore été sauvegardées en version. Si vous quittez, ces modifications seront perdues.",
  stayLabel = "Rester sur la page",
  leaveLabel = "Quitter sans sauvegarder",
}: Props) {
  return (
    <Modal
      isOpen={open}
      onClose={onStay}
      title={title}
      description={description}
      size="sm"
      icon={<AlertTriangle className="h-4 w-4" />}
      preventCloseOnOutside
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onStay}>
            {stayLabel}
          </Button>
          <Button variant="destructive" size="sm" onClick={onLeave}>
            {leaveLabel}
          </Button>
        </div>
      }
    />
  );
}
