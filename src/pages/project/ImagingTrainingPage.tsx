import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { ImagingWizardContainer } from "@/components/imaging/wizard/ImagingWizardContainer";

export function ImagingTrainingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 pb-8 sm:space-y-6">
        <ImagingWizardContainer
          projectId={id}
          onBack={() => navigate(`/projects/${id}/imaging/import`)}
        />
      </div>
    </AppLayout>
  );
}

export default ImagingTrainingPage;
