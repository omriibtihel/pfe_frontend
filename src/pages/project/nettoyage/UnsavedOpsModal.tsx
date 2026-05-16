import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  title,
  description,
  stayLabel,
  leaveLabel,
}: Props) {
  const { t } = useTranslation();
  title = title ?? t("nettoyage.unsaved.title");
  description = description ?? t("nettoyage.unsaved.desc");
  stayLabel = stayLabel ?? t("nettoyage.unsaved.stay");
  leaveLabel = leaveLabel ?? t("nettoyage.unsaved.leave");
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
