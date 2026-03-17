import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import datasetService, { DatasetOut } from '@/services/datasetService';
import databaseService, {
  DatasetOverviewOut,
  DatasetProfileOut,
} from '@/services/databaseService';

export type ExplorationData = {
  datasets: DatasetOut[];
  activeDatasetId: number | null;
  overview: DatasetOverviewOut | null;
  profile: DatasetProfileOut | null;
  targetColumn: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
};

export type ExplorationActions = {
  reload: (opts?: { forceDatasetId?: number }) => Promise<void>;
  changeActiveDataset: (datasetId: number) => Promise<void>;
  setTargetColumn: (col: string | null) => void;
  refreshPreview: (rows: number, topK: number) => Promise<void>;
};

export function useDataExploration(projectId: string): ExplorationData & ExplorationActions {
  const { toast } = useToast();

  const [datasets, setDatasets] = useState<DatasetOut[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [overview, setOverview] = useState<DatasetOverviewOut | null>(null);
  const [profile, setProfile] = useState<DatasetProfileOut | null>(null);
  const [targetColumn, setTargetColumnState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reload = useCallback(
    async (opts?: { forceDatasetId?: number }) => {
      setIsRefreshing(true);
      try {
        const ds = await datasetService.list(projectId);
        setDatasets(ds as DatasetOut[]);

        const active = await databaseService.getActiveDataset(projectId);
        const chosen =
          opts?.forceDatasetId ??
          active.active_dataset_id ??
          (ds?.[0]?.id ?? null);

        setActiveDatasetId(chosen);

        if (!chosen) {
          setOverview(null);
          setProfile(null);
          setTargetColumnState(null);
          return;
        }

        const [o, p, t] = await Promise.all([
          databaseService.getOverview(projectId, chosen, 20),
          databaseService.getProfile(projectId, chosen, 5),
          databaseService.getDatasetTarget(projectId as string, chosen),
        ]);

        setOverview(o);
        setProfile(p);
        setTargetColumnState(t.target_column ?? null);
      } catch (err) {
        toast({
          title: 'Erreur de chargement',
          description: (err as Error).message || 'Impossible de charger les données.',
          variant: 'destructive',
        });
      } finally {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    },
    [projectId, toast],
  );

  useEffect(() => {
    setIsLoading(true);
    void reload();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeActiveDataset = useCallback(
    async (datasetId: number) => {
      setActiveDatasetId(datasetId);
      setOverview(null);
      setProfile(null);
      setTargetColumnState(null);
      await databaseService.setActiveDataset(projectId, datasetId);
      await reload({ forceDatasetId: datasetId });
    },
    [projectId, reload],
  );

  const refreshPreview = useCallback(
    async (rows: number, topK: number) => {
      if (!activeDatasetId) return;
      setIsRefreshing(true);
      try {
        const [o, p] = await Promise.all([
          databaseService.getOverview(projectId, activeDatasetId, rows),
          databaseService.getProfile(projectId, activeDatasetId, topK),
        ]);
        setOverview(o);
        setProfile(p);
      } catch (err) {
        toast({
          title: 'Erreur',
          description: (err as Error).message,
          variant: 'destructive',
        });
      } finally {
        setIsRefreshing(false);
      }
    },
    [projectId, activeDatasetId, toast],
  );

  return {
    datasets,
    activeDatasetId,
    overview,
    profile,
    targetColumn,
    isLoading,
    isRefreshing,
    reload,
    changeActiveDataset,
    setTargetColumn: setTargetColumnState,
    refreshPreview,
  };
}
